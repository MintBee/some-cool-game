# MVP Review #001 — P2P Verification Session

> **Date:** 2026-04-04
> **Reviewer:** Claude (automated + browser-tested)
> **Scope:** Full GDD spec compliance, P2P networking, game loop integrity
> **Method:** Code review of all critical files + 2-tab browser P2P testing

---

## 1. Spec Compliance Summary

### Fully Implemented (Matches GDD)

| GDD Section | Feature | Status |
|---|---|---|
| 1.1 | Deploy left-to-right, no gaps, Frontier before Shadow | Correct |
| 1.2 | Room join, game starts when full, roster locked | Correct |
| 1.2 | Round-robin pairing (N-player schedules) | Correct |
| 1.2 | First to 10 trophies wins | Correct |
| 1.2 | KO / HP-lead / tie / double-KO trophy rules | All 4 cases correct |
| 1.3 | Battle Prep: 1 card from reserve, any position, R3+ | Correct |
| 1.3 | Battle Prep card completely hidden | Correct |
| 1.4 | Lane-by-lane left-to-right auto-resolve | Correct |
| 2.1 | 7 lanes, 30 HP, 9-card deck | Correct |
| 2.2 | Priority ordering Disrupt(P0) > Shield(P1) > Buff(P2) > Strike(P3) > Nuke(P4) | Correct |
| 2.2 | Same priority = simultaneous activation | Correct |
| 2.3 | Three-tier visibility: Frontier(full), Shadow(type-only), BattlePrep(hidden) | Correct |
| 2.4 | R1=3, R2=5, R3=7, R4+=7 deploy limits | Correct |
| 3.1 | Shown 3 random cards, choose 1 | Correct |
| 3.2 | Building phase: 3+2+2+2 = 9 cards | Correct |
| 3.4 | Card retention across rounds | Correct (HostEngine.playerDecks Map) |
| 4 | 22-card catalog, 5 types, T1/T2/T3 tiers | Correct |
| 4 | Disrupt weaken, Shield absorb/reflect, Buff fragility, Nuke conditionals, all Strike variants | Correct |
| 5 | Key interaction matrix | Covered by priority system + lane resolver |

### Partially Implemented / Simplified

| GDD Section | Feature | Spec | MVP | Gap |
|---|---|---|---|---|
| 1.2 | Room sizes | 2, 4, or 6 players | Client hardcodes 2 | Server supports configurable capacity; client doesn't expose it |
| 1.4 | Poker-style reveal | Slow, dramatic lane flip | 800ms delay between reveals, no flip animation | Missing card flip visual; pacing exists |
| 3.1 | Card pool size | "25-card pool" | 22 cards in catalog | 3 cards short of spec |
| 1.3 | BattlePrep insertion position | "any position" | Client always inserts at end | Validator supports any position; UI doesn't offer choice |

### Not Implemented (Stubbed)

| GDD Section | Feature | Impact |
|---|---|---|
| 3.2 | **Replacement phase (R4-R9)** — discard 1, pick 1 | Deck frozen at 9 after R3. No mid-game adaptation. |
| 3.2 | **Reinforcement phase (R10+)** — mandatory tier upgrade | Cards stay T1 forever. No late-game power scaling. |
| 6 | Victory/defeat screen | Game stops silently at 10 trophies. No winner announcement. |
| 6 | Battle replay/review | Not implemented |
| 6 | Phase timer countdown UI | Timer value in state but no visual countdown rendered |

---

## 2. Bugs Found and Fixed

Five blocking P2P bugs were discovered during browser testing and fixed:

| # | Bug | Root Cause | File | Severity |
|---|---|---|---|---|
| 1 | Game stuck on "Setting up game..." | `runBuildingPhase()` never called `broadcastState()` — viewModel stayed null | `HostEngine.ts` | **Critical** |
| 2 | "Invalid action from undefined" errors | All `GameMessage` types cast as `Action` via `onMessage` | `HostEngine.ts` | **Critical** |
| 3 | Non-host never receives initial state | WebRTC DataChannel not open when HostEngine sends first messages | `P2PAdapter.ts` | **Critical** |
| 4 | Host draft panel goes blank after pick | `setDraftChoices([])` ran after synchronous `handleIncomingAction` which had already set new choices | `GameClient.tsx` | **Major** |
| 5 | Hand panel empty during Prep | `applyPick()` added to `deck` but never updated `reserve` | `economy.ts` | **Critical** |

**Security fix applied:** Draft pick validation now ensures players can only pick cards from their offered choices, not arbitrary catalog cards.

---

## 3. Features NOT in Spec but Present in MVP

| Feature | Location | Assessment |
|---|---|---|
| Phase timers (30s Prep, 15s BattlePrep) + auto-ready | `HostEngine.ts`, `config.ts` | Good addition — prevents indefinite stalling |
| Lane reveal pacing (800ms between reveals) | `HostEngine.ts:266` | Good — creates tension per GDD spirit |
| Round transition delay (2000ms) | `HostEngine.ts:306` | Good — breathing room between rounds |
| Seeded PRNG (mulberry32) | `rng.ts` | Good — enables deterministic testing and replay potential |
| Connection status indicator | `ConnectionStatus.tsx` | Good UX — not in spec but essential for P2P |
| Dev/Mock mode (`?mode=dev`) | `dev/MockGame.tsx` | Good — accelerates development iteration |
| Random player ID generation | `Lobby.tsx` | Placeholder — will need proper auth for production |

---

## 4. Product Viability Assessment

### Can This MVP Become a Real Product?

**Yes, with caveats.** The architecture is sound for a browser-based card game. Here's a breakdown:

#### Strengths (Production-Ready Patterns)

1. **Clean module separation** — shared engine (pure TS, deterministic) / client (Preact + SVG) / server (ws signaling). Any module can be replaced independently.

2. **Deterministic engine** — `applyAction(state, action) -> GameState` reducer pattern. Seeded RNG. This enables replays, spectating, and server-side validation if needed later.

3. **Anti-cheat boundary** — `filterStateForPlayer()` strips hidden card data before sending to opponents. Shadow cards show type-only; BattlePrep cards show nothing. This is the correct approach.

4. **Host authority model** — single source of truth, validated actions, filtered state sync. Prevents most common multiplayer cheats.

5. **Comprehensive card system** — 22 cards with 5 types, priority ordering, carry-over effects (Aegis shield, active buffs), conditional nukes, formation buffs. The interaction matrix is rich enough for strategic depth.

6. **Test coverage** — 62 tests across engine, server, and client. Integration tests verify full game flows.

#### Gaps for Production

| Category | Gap | Effort | Priority |
|---|---|---|---|
| **Networking** | WebRTC P2P means host has advantage (lower latency, sees raw state). Real product needs a dedicated server. | High | P1 |
| **Networking** | No reconnection support. Disconnect = game over. | Medium | P1 |
| **Economy** | Replacement + Reinforcement phases stubbed. Game stagnates after R3. | Medium | P1 |
| **Persistence** | All state is in-memory on host peer. No database, no accounts, no history. | High | P1 |
| **UX** | No victory screen, no timer countdown, no deploy animation, no sound. | Medium | P2 |
| **Scale** | P2P limits to 2 players effectively. 4/6 player rooms need dedicated relay. | High | P2 |
| **Auth** | Random player IDs. No login, no profiles, no progression. | Medium | P2 |
| **Balance** | Card stats are initial values. No playtesting data to tune damage/shield ranges. | Ongoing | P2 |
| **Mobile** | Desktop-first viewport (1400x700 SVG). Not mobile-responsive. | Medium | P3 |

#### Verdict

The MVP proves the **core game loop works**: draft cards, deploy to lanes, resolve battles with priority-based combat, track trophies across rounds. The card interaction system is the most complete part — all 22 cards with their type-specific mechanics function correctly.

**To reach a playable product**, the minimum path is:
1. Fix the 2 stubbed economy phases (Replacement + Reinforcement)
2. Add a victory screen
3. Move from P2P to a lightweight dedicated server (the engine is already server-ready)
4. Add reconnection support

**To reach a shippable product**, additionally:
5. User accounts + persistence
6. Card balance tuning via playtesting
7. Polish: animations, sound, mobile layout
8. Matchmaking beyond named rooms

The architecture doesn't need rethinking — the module boundaries and data flow are correct. The work is additive, not structural.

---

## 5. Test Results

```
@game/shared:  6 test files, 47 tests passed
@game/server:  1 test file,   7 tests passed
@game/client:  1 test file,   8 tests passed
─────────────────────────────────────────────
Total:         8 test files, 62 tests passed, 0 failed
```

All tests pass after bug fixes. No regressions introduced.
