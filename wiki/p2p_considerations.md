# P2P (WebRTC) Considerations

> **Companion doc:** [Technical Specification](technical_spec.md)

This document records the risks, trade-offs, and architectural decisions for using WebRTC DataChannels as the MVP networking layer. Update this file as decisions are validated or revised during implementation.

---

## 1. Infrastructure Required

Even a "pure P2P" game needs three server-side components:

| Component | Purpose | MVP Choice |
| --------- | ------- | ---------- |
| **Signaling server** | Relay SDP offers/answers and ICE candidates between peers during connection setup. Carries **no game traffic** after peers connect. | Node.js + `ws` (self-hosted, same process as lobby) |
| **STUN server** | Tell each peer its public IP:port so it can attempt a direct connection (succeeds ~70–75% of the time) | Google public STUN: `stun.l.google.com:19302` |
| **TURN server** | Relay encrypted packets when direct P2P fails (symmetric NAT, strict firewalls) — needed by ~25–30% of users | Self-hosted Coturn |

The signaling server is the only component with lobby state (seat count, room lock). STUN and TURN are stateless from the game's perspective.

---

## 2. Risk Register

### 2.1 NAT Traversal — CRITICAL

**Problem:** ~25–30% of users are behind symmetric NAT or strict firewalls where STUN-based direct connection fails. Without TURN, those users cannot connect.

**Impact:** Silent connection failure; match never starts.

| Mitigation | Detail |
| ---------- | ------ |
| Deploy Coturn TURN server | Self-host on a cheap VPS (low bandwidth — only game messages, not audio/video). Geographic placement in one region is acceptable for MVP. |
| ICE timeout strategy | If direct connection hasn't established within 5 s, surface "connecting via relay…" to users rather than hanging silently. |
| Monitor ICE candidate types | Log `host`, `srflx` (STUN), `relay` (TURN) success rates. Alert if relay fraction exceeds 40% (indicates STUN misconfiguration). |

---

### 2.2 Authority Model / Cheating — CRITICAL

**Problem:** The host peer runs the Core Engine locally. It has full knowledge of all players' hidden cards and controls RNG (draft pool generation). A cheating host can manipulate any game outcome undetected in real time.

**Impact:** Competitive integrity is compromised. Acceptable for casual MVP play; unacceptable if ranked/competitive modes are added.

| Mitigation | Detail |
| ---------- | ------ |
| Signed move log | Host signs each outbound game message with a session keypair (generated at match start, public key exchanged via signaling). Non-host peers can verify message authenticity post-game. |
| Post-game replay hash | At match end, host sends a hash of the full move log + RNG seed. Non-host peers re-run the simulation locally and compare. Mismatch flags the match for review. |
| Win-rate anomaly detection | Track per-player host win rate server-side (signaling server can log match results). Flag accounts with host win rate >65% over 20+ games. |
| Future: upgrade to Colyseus | Moving to a dedicated server eliminates this risk entirely. See §5. |

---

### 2.3 Latency & Reliability — HIGH

**Problem:** A single ordered, reliable DataChannel creates head-of-line blocking — one lost packet stalls all subsequent messages until it retransmits. For a turn-based game this is acceptable but can cause noticeable freezes during reveals.

**Impact:** Reveal animations stall; phase timers may expire during retransmit delay.

| Mitigation | Detail |
| ---------- | ------ |
| Split DataChannels | **Channel 1** (`game`, reliable + ordered): game moves, state sync, lane reveal, battle result. **Channel 2** (`ui`, unreliable + unordered): non-critical hints (e.g., "opponent is typing", hover previews). Each channel has its own SCTP stream — blocking on one does not affect the other. |
| Keep messages small | Game move payloads are tiny (card IDs, slot numbers). No chunking needed. Avoid sending full `GameState` blobs; send deltas. |
| Phase timer buffer | Add a 2 s buffer to phase timer enforcement so a single retransmit doesn't auto-expire a player's turn. |

---

### 2.4 Connection Lifecycle & Disconnection — HIGH

**Problem:** WebRTC has no push notification for peer disconnection. If a peer goes offline (e.g., closes laptop, loses WiFi), the other peer learns about it only via timeout — which can take 15–30 s by default.

**Impact:** Match hangs waiting for an offline peer.

| Mitigation | Detail |
| ---------- | ------ |
| Heartbeat | Host sends `ping` every 10 s on the `game` channel. If 2 consecutive pings go unanswered (20 s), the peer is declared offline. |
| Reconnection window | Non-host peer has 60 s to reconnect via the signaling server. On rejoin, host replays the full move log so the peer can reconstruct current `GameState`. |
| Auto-forfeit | If a non-host peer is offline for >30 s without reconnecting, the host auto-forfeits that peer's current battle. Match continues for remaining players (round-robin). |
| Host disconnect = match over | Host reconnection is not supported in MVP. If the host goes offline and does not reconnect within 60 s, the match is abandoned and all players are returned to lobby. Match result is voided. |
| Explicit close signal | Before intentionally closing a connection, the host sends a `matchAbandoned` or `battleResult` message on the `game` channel so peers receive a clean signal rather than timing out. |

---

### 2.5 Mesh Scalability — HIGH

**Problem:** Full P2P mesh requires N×(N−1) connections for N peers. For 6 players: 30 connections total, 5 per peer. While manageable for a turn-based game (low message rate), connection setup time and CPU overhead grow with room size.

| Players | Connections (mesh) | Connections per peer |
| ------- | ------------------ | -------------------- |
| 2       | 2                  | 1                    |
| 4       | 12                 | 3                    |
| 6       | 30                 | 5                    |

**Decision: host-peer star topology for 6-player rooms.** All non-host peers connect only to the host (1 DataChannel each). The host relays messages between pairings. This reduces non-host peer connections from 5 to 1, at the cost of the host having 5 outbound connections (acceptable — host is a desktop/laptop for MVP).

2- and 4-player rooms continue to use full mesh (simpler routing, no relay logic on host).

---

### 2.6 Signaling Server as SPOF — MEDIUM

**Problem:** The signaling server is required to form new rooms. If it goes down, no new matches can start (existing connected matches are unaffected — they run over DataChannels).

**Impact:** New players cannot join; ongoing matches are not interrupted.

| Mitigation | Detail |
| ---------- | ------ |
| Health check endpoint | `GET /health` returns 200. Monitor with a simple uptime service; alert on failure. |
| Stateless signaling | Signaling server holds no persistent match state — only transient lobby data. A restart drops in-progress lobby connections (not in-game matches). Reconnect clients automatically retry. |
| Reconnection fallback | If a non-host peer loses the signaling WebSocket mid-match, reconnection is attempted directly over the existing DataChannel (ping/pong). Signaling is only needed for the initial handshake. |

---

### 2.7 Security (DTLS & IP Exposure) — MEDIUM

**Problem A — IP exposure:** During ICE negotiation, each peer's public IP is shared with the other peer via the signaling server. A malicious player learns their opponent's IP and could launch a targeted DDoS.

**Problem B — No server-side validation:** DTLS provides transport encryption (equivalent to TLS), but the non-host peer cannot verify that the host's game logic is running correctly. Messages are confidential but not provably correct.

| Mitigation | Detail |
| ---------- | ------ |
| Relay ICE candidates through signaling | Never expose raw ICE candidates directly in the UI or logs. Candidates transit signaling server only; peers don't see each other's IPs until WebRTC internals establish the connection. |
| TURN-only mode (future) | For users who report harassment/DDoS, offer a "privacy mode" that forces TURN relay — opponent sees only the TURN server IP, not the real IP. |
| Signed move log (see §2.2) | Addresses correctness verification at the application layer. |
| WSS for signaling | Signaling server must use `wss://` (TLS). Never `ws://`. Prevents signaling message interception. |

---

### 2.8 Browser Compatibility — MEDIUM

**Problem:** WebRTC DataChannel is broadly supported but has gaps on older Safari and non-standard environments.

| Environment | DataChannel support |
| ----------- | ------------------- |
| Chrome / Edge (Chromium) | Full |
| Firefox | Full |
| Safari 15.1+ (desktop + iOS) | Full |
| Safari < 15.1 | **Not supported** |
| IE 11 / Legacy Edge | Not supported (ignore) |

**Impact:** Users on Safari < 15.1 or very old mobile browsers cannot play.

| Mitigation | Detail |
| ---------- | ------ |
| Feature detection on load | Check `RTCPeerConnection` and `RTCDataChannel` at startup. Show a clear "your browser is not supported" message with upgrade instructions rather than a silent failure. |
| Include `webrtc-adapter` | Smooths minor API differences between Chrome/Firefox/Safari. Lightweight shim, no significant overhead. |
| Future fallback | The Colyseus adapter (future) uses WebSocket, which works everywhere. Users blocked on WebRTC can fall back to server-based play when that adapter ships. |

---

## 3. Architecture Decisions Summary

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Host peer election | First joiner is host | Deterministic, no election round-trip. Host role locked at `matchStarted`. |
| Host migration | Not supported (MVP) | Complexity outweighs benefit for casual MVP. Match abandoned if host disconnects. |
| DataChannel config | Two channels: `game` (reliable+ordered) / `ui` (unreliable+unordered) | Prevents head-of-line blocking on UI hints; keeps game moves reliable. |
| Heartbeat interval | 10 s ping, 2 misses = offline | Balances responsiveness vs. false positives on slow networks. |
| Offline timeout | 30 s → auto-forfeit battle; 60 s → abandon match | Prevents indefinite hangs. |
| Reconnection | 60 s window; host replays move log | Peer can reconstruct `GameState` deterministically from move log + RNG seed. |
| 6-player topology | Host-peer star (not full mesh) | Caps non-host peers at 1 connection; host handles relay. |
| Cheating stance | Detective (log + replay), not preventive | Acceptable for casual MVP; upgrade to Colyseus for competitive integrity. |
| IP privacy | Candidates relayed through signaling server | Opponent IP not directly visible in UI or logs. |

---

## 4. What the Signaling Server Does (and Does Not Do)

**Does:**
- Accept `joinRoom(roomId)` WebSocket messages from clients
- Track lobby seat counts and reject joins to full rooms
- Relay SDP offers, SDP answers, and ICE candidates between peers
- Emit `matchStarted` with host designation once all seats are filled
- Lock roster (`MatchState.locked = true`) and reject subsequent join attempts
- Proxy reconnection signals for non-host peers (send "peer reconnecting" to host)
- Log match results (winner, duration) for win-rate anomaly detection

**Does not:**
- Validate game moves
- Store or relay `GameState`
- Run any Core Engine logic
- Carry any in-match game traffic (all game messages flow over DataChannels)

---

## 5. Future: Upgrading to Colyseus

Trigger conditions for switching from P2P to Colyseus:

1. **Competitive integrity required** — ranked modes demand server-side anti-cheat
2. **Host abuse** — win-rate anomaly rate exceeds acceptable threshold
3. **Mesh limits** — room sizes beyond 6 players or high-frequency game modes

Migration path:
- Implement `adapters/colyseus/` as a new `INetworkAdapter` implementation
- `BattleRoom` (Colyseus `Room` subclass) takes over `MatchManager` and Core Engine execution
- `SignalingServer` is replaced by Colyseus room matching
- **Zero changes to Core Engine, UI, or game logic**

The entire P2P risk profile (§2) becomes moot once Colyseus is the primary adapter.
