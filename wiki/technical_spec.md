# Technical Specification — Card Battle Game

> **Version:** 1.0
> **Status:** Draft
> **Companion docs:** [GDD v4.0](GDD.md) · [Card Design](card_design.md)

---

## 1. Tech Stack

| Layer              | Choice                  | Rationale                                                                  |
| ------------------ | ----------------------- | -------------------------------------------------------------------------- |
| **Language**       | TypeScript (strict)     | Shared types between client and server; catches card-logic bugs at compile time |
| **Rendering**      | PixiJS 8                | Lightweight 2D WebGL renderer; ideal for card animations without Phaser's overhead |
| **UI Overlay**     | Preact + HTM            | Thin reactive layer for HUD, menus, lobby — renders to DOM above the Pixi canvas |
| **Networking**     | Colyseus 0.15           | Authoritative game rooms, schema-based state sync over WebSocket           |
| **Server**         | Node.js 20 + Colyseus   | Colyseus runs on Node; no separate HTTP framework needed for game logic    |
| **Monorepo**       | Turborepo + pnpm        | Three sources: `client`, `server`, `shared` with single `tsconfig` base  |
| **Build (client)** | Vite 6                  | Fast HMR, native TS, trivial Pixi asset pipeline                          |
| **Build (server)** | tsx (dev) / tsup (prod) | Fast dev reload; single-file production bundle                             |
| **Testing**        | Vitest + Playwright     | Unit tests for shared game logic; E2E for full client-server flows         |
| **Linting**        | Biome                   | Single tool for format + lint; faster than ESLint + Prettier               |

### Why PixiJS over Phaser

Phaser bundles a physics engine, scene manager, and input system designed for action games. This card game needs none of those — it needs sprite rendering, tweened animations (card flips, slide-ins), and layered containers for zones. PixiJS is roughly 1/3 the bundle size and gives full control over the render loop without fighting a framework.

### Why Colyseus over raw WebSocket

The game has well-defined rooms (2–5 player free-for-all matches), phased state transitions, and needs authoritative validation. Colyseus provides room lifecycle, delta-compressed state sync, reconnection, and room-based matchmaking out of the box. Its schema system maps naturally to the lane/card data model.

---

## 2. Module Structure

Three core modules with clean interfaces between them. Any layer can be swapped independently — e.g., the network module can move from central server to P2P without touching game logic or UI.

### 2.1 Module Diagram

```mermaid
flowchart LR
    UI["UI\nPixiJS + Preact"]
    Core["Core Game Engine\nshared/"]
    Net["Network\nINetworkAdapter"]

    UI -- "player actions" --> Core
    Core -- "GameState updates" --> UI
    Core -- "INetworkAdapter" --> Net
    Net -- "state sync" --> Core
```

- **UI → Core:** "Player wants to deploy card X at slot 3" (intent)
- **Core → Network:** "Validated action, broadcast to opponent" (via adapter)
- **Network → Core:** "Opponent deployed card Y" (incoming action)
- **Core → UI:** "State updated, re-render" (new GameState)
- **Core (RoomController):** Owned by Core Engine — match lifecycle, per-player visibility filtering, and phase timer policy are pure domain logic; the Network layer schedules OS timers and sends filtered state based on values returned by `RoomController`

### 2.2 Module 1: UI

Responsible for rendering, input, and presentation. Knows nothing about networking.

| Sub-module         | Responsibility                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| `scenes/`          | Pixi containers: PrepScene, BattleScene, DraftScene — one active at a time                        |
| `rendering/`       | CardSprite (3 visual states: hidden / type-only / full), Animator (card flips, lane reveals, FX)   |
| `components/`      | Preact HUD overlay — HP bar, round counter, phase indicator, card tooltips, menus                  |
| `state/ViewModel`  | Derives displayable state from the Core Engine's GameState, respecting visibility zone rules       |

**Interface:** Consumes `GameState` (read-only) from Core Engine; emits player actions (`deployCard`, `pickCard`, `ready`, etc.) as intents.

### 2.3 Module 2: Core Game Engine

Pure game logic — deterministic, platform-agnostic, no I/O. This is the shared brain that runs identically on client, server, or P2P host.

| Sub-module          | Responsibility                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `types/`            | All interfaces and enums: `Card`, `GameState`, `PlayerState`, `LaneResult`, `Phase`, `CardType`, `Tier`       |
| `cards/catalog`     | 25-card catalog as typed constant map — id, name, type, priority, base stats, tier scaling, ability descriptor |
| `cards/abilities`   | Pure functions for each ability's effect signature (inputs/outputs)                                            |
| `rules/lane`        | `resolveLane(cardA, cardB, context): LaneResult` — priority ordering, disrupt, shields, buffs, nukes          |
| `rules/economy`     | Phase transition logic — which picks/discards/upgrades are legal given the current round                      |
| `rules/deploy`      | Zone constraints (Frontier before Shadow), contiguous placement, Battle Prep insertion shifting                |
| `engine/PhaseManager`    | State machine: BUILDING → PREP → MATCHING → BATTLE_PREP → BATTLE → RESULT                                                                                                                                                     |
| `engine/Validator`       | Validates any player action against current state — anti-cheat layer when run server-side                                                                                                                                     |
| `engine/RoomController`  | Match lifecycle (pair players, start, end), visibility filtering per player, phase timer policy (durations and auto-advance action); returns filtered `PlayerView` objects and emits `RoomEvent` values — no I/O, fully testable |

**Interface:** Exposes `applyAction(state, action): GameState`, `resolveLane()`, and `RoomController` (instantiated once per match). No side effects, fully testable.

### 2.4 Module 3: Network

Abstracted transport layer. Defines interfaces so the implementation can be swapped without touching game logic or rendering.

| Sub-module             | Responsibility                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `interface/`           | `INetworkAdapter` — `connect()`, `sendAction()`, `onStateUpdate()`, `onLaneReveal()`, etc.            |
| `adapters/colyseus/`   | Central server adapter — authoritative Colyseus rooms, schema sync, room-based matchmaking             |
| `adapters/p2p/`        | (Future) P2P adapter — WebRTC DataChannels, one peer acts as host running the Core Engine              |
| `server/BattleRoom`    | Thin Colyseus `Room` subclass — WebSocket transport only; delegates match lifecycle, visibility filtering, and phase timer enforcement to `shared/engine/RoomController`; schedules OS timers based on durations `RoomController` provides |
| `messages/`            | Typed message definitions shared by all adapters                                                       |

**Matchmaking:** Room-based free-for-all — 2 to 5 players join the same room and compete directly. No global queue. The match starts when the host triggers it or a configurable threshold is reached.

**Interface:** UI and Core Engine interact with Network only through `INetworkAdapter`. Swapping from Colyseus to P2P requires zero changes to game logic or rendering.

---

## 3. Authority Model

The server (or host peer in P2P) is the single source of truth. The client is a view layer that sends intents and renders confirmed state.

### Server / Host owns (via RoomController + BattleRoom)

| Concern                | Detail                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Card resolution        | All lane outcomes computed via `shared/rules/lane`                 |
| Visibility enforcement | `RoomController.getPlayerView(state, playerId)` computes filtered state; `BattleRoom` serializes and transmits it |
| Deploy validation      | Every placement checked against zone rules and deck contents       |
| Economy validation     | Draft picks, discards, upgrades validated against phase rules      |
| Timers                 | Phase duration policy defined in `RoomController` (returns duration and fallback action); `BattleRoom` schedules the OS timer and calls `RoomController.handleTimeout()` on expiry |
| Randomness             | Card draft pool (3 random from 25) generated server-side           |

### Client owns

| Concern                | Detail                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Animation pacing       | Controls reveal animation speed (within server timeout)            |
| UI layout              | Card arrangement, drag targets, cosmetic preferences               |
| Input                  | Which card to play where — sent as intent, validated by server     |

Because Core Engine is a standalone module, it runs identically whether hosted on a dedicated server (Colyseus) or on a host peer (P2P). The network adapter determines *where* it runs, not *how*.

---

## 4. Data Flow

### 4.1 Match Lifecycle (2-player reference)

> **Note:** The sequence below illustrates the 2-player case. Multi-player (3–5) generalizes this — additional clients follow the same message pattern; lane collision and elimination sequencing across more than 2 players are open design questions (see GDD §7).

```mermaid
sequenceDiagram
    participant A as Client A
    participant S as Server / Host
    participant B as Client B

    A->>S: joinRoom()
    B->>S: joinRoom()
    Note over S: room pairs A + B
    S->>A: matchStarted
    S->>B: matchStarted

    Note over A,B: BUILDING PHASE (rounds 1-3)
    S->>A: draftChoices(3)
    S->>B: draftChoices(3)
    A->>S: pickCard(id)
    B->>S: pickCard(id)
    S->>A: deckUpdate
    S->>B: deckUpdate
    Note over A,B: repeat per pick

    Note over A,B: PREPARATION PHASE
    A->>S: deployCard(slot)
    Note over S: validate
    S->>A: stateSync
    S->>B: opponentPartial
    Note over S,B: frontier=full, shadow=type only, battlePrep=hidden
    A->>S: ready()
    B->>S: ready()

    Note over A,B: BATTLE PHASE (lane-by-lane)
    Note over S: resolve lane 1
    S->>A: laneReveal(1)
    S->>B: laneReveal(1)
    Note over A: cardA, cardB, result, hpDelta
    Note over A,B: lanes 2-7...
    S->>A: battleResult
    S->>B: battleResult
    Note over A: winner, trophies
```

### 4.2 Key Message Types

| Direction       | Message            | Payload                                                        |
| --------------- | ------------------ | -------------------------------------------------------------- |
| Server → Client | `draftChoices`     | `Card[3]` — three cards to pick from                           |
| Client → Server | `pickCard`         | `{ cardId }`                                                   |
| Client → Server | `deployCard`       | `{ cardId, slot }`                                             |
| Client → Server | `insertBattlePrep` | `{ cardId, position }`                                         |
| Client → Server | `discardCard`      | `{ cardId }` (Replacement phase)                               |
| Client → Server | `upgradeCard`      | `{ cardId }` (Reinforcement phase)                             |
| Client → Server | `ready`            | `{}` — signals phase completion                                |
| Server → Client | `stateSync`        | Delta-compressed state patch (own full state)                  |
| Server → Client | `opponentPartial`  | Visibility-filtered opponent board                             |
| Server → Client | `laneReveal`       | `{ lane, cards: [Card, Card], result: LaneResult }`            |
| Server → Client | `battleResult`     | `{ winner, hpA, hpB, trophies: [number, number] }`            |

### 4.3 Visibility Filtering

The server maintains full game state but **filters outgoing data per player**:

```mermaid
flowchart TD
    FS["Server full state"]
    FS --> VA["Player A view"]
    FS --> VB["Player B view"]

    VA --> A1["Own cards — full"]
    VA --> A2["Opponent Frontier — full"]
    VA --> A3["Opponent Shadow — type only"]
    VA --> A4["Opponent Battle Prep — hidden"]

    VB --> B1["Own cards — full"]
    VB --> B2["Opponent Frontier — full"]
    VB --> B3["Opponent Shadow — type only"]
    VB --> B4["Opponent Battle Prep — hidden"]
```

Opponent card IDs and stats in Shadow/BattlePrep zones are **never serialized to the wire**. This is the primary anti-cheat boundary.

---

## 5. State Schema

```mermaid
graph TD
    GS["GameState"]
    GS --> phase["phase: Phase\nBUILDING | PREP | BATTLE_PREP | BATTLE | RESULT"]
    GS --> round["round: number"]
    GS --> players["players: Map&lt;string, PlayerState&gt;"]
    GS --> lanes["lanes: LaneState[7]"]
    GS --> timers["timers"]

    players --> PS["PlayerState"]
    PS --> hp["hp: number"]
    PS --> trophies["trophies: number"]
    PS --> deck["deck: Card[9]\nfull deck — server-only for opponent"]
    PS --> deployed["deployed: Card[7]\nordered lane assignments"]
    PS --> zones["zones"]
    PS --> reserve["reserve: Card[]"]

    zones --> frontier["frontier: [0, 1, 2]"]
    zones --> shadow["shadow: [3, 4, 5]"]
    zones --> battlePrep["battlePrep: [6]"]

    lanes --> LS["LaneState"]
    LS --> resolved["resolved: boolean"]
    LS --> cardA["cardA: CardId | null"]
    LS --> cardB["cardB: CardId | null"]
    LS --> result["result: LaneResult | null"]

    timers --> phaseEnd["phaseEnd: timestamp"]
```

---

## 6. Build & Dev Workflow

### Directory Layout

```
some-cool-game/
├── sources/
│   ├── shared/      ← Module 2 (Core Game Engine) — pure TS, no deps
│   ├── server/      ← Module 3 server-side (Colyseus adapter + BattleRoom)
│   └── client/      ← Module 1 (UI) + Module 3 client-side (network adapter)
├── turbo.json       ← pipeline: shared → server/client in parallel
├── package.json     ← workspace root
└── wiki/            ← design & technical docs
```

### Dev Commands

| Command      | Effect                                                          |
| ------------ | --------------------------------------------------------------- |
| `pnpm dev`   | Starts all three sources (shared watch + server + client)       |
| `pnpm test`  | Runs Vitest across all workspaces                               |
| `pnpm build` | Production build: shared → server bundle + client static assets |

---

## 7. Open Technical Decisions

| Decision                  | Options                                | Recommendation                                                            |
| ------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Animation library         | gsap, @pixi/animate, custom tweens     | gsap — proven, timeline sequencing fits poker-style lane reveals           |
| Persistent storage        | None (MVP), PostgreSQL, SQLite         | None for MVP; add PostgreSQL via Drizzle ORM when accounts needed          |
| Reconnection window       | Colyseus default, custom               | 60s grace period; opponent sees "reconnecting..."                         |
| Turn timer duration       | Fixed vs. configurable                 | 30s prep phase, 15s battle prep; configurable in `shared/config`          |
| Asset pipeline            | Sprite sheets vs. individual PNGs      | TexturePacker → sprite sheets loaded via Pixi Assets                      |
| Card art (placeholder)    | Colored shapes, text-only              | Colored geometric shapes as T1 placeholder art                            |
