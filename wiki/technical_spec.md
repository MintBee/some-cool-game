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
| **Monorepo**       | Turborepo + pnpm        | Three packages: `client`, `server`, `shared` with single `tsconfig` base  |
| **Build (client)** | Vite 6                  | Fast HMR, native TS, trivial Pixi asset pipeline                          |
| **Build (server)** | tsx (dev) / tsup (prod) | Fast dev reload; single-file production bundle                             |
| **Testing**        | Vitest + Playwright     | Unit tests for shared game logic; E2E for full client-server flows         |
| **Linting**        | Biome                   | Single tool for format + lint; faster than ESLint + Prettier               |

### Why PixiJS over Phaser

Phaser bundles a physics engine, scene manager, and input system designed for action games. This card game needs none of those — it needs sprite rendering, tweened animations (card flips, slide-ins), and layered containers for zones. PixiJS is roughly 1/3 the bundle size and gives full control over the render loop without fighting a framework.

### Why Colyseus over raw WebSocket

The game has well-defined rooms (1v1 matches), phased state transitions, and needs authoritative validation. Colyseus provides room lifecycle, delta-compressed state sync, reconnection, and room-based matchmaking out of the box. Its schema system maps naturally to the lane/card data model.

---

## 2. Module Structure

Three core modules with clean interfaces between them. Any layer can be swapped independently — e.g., the network module can move from central server to P2P without touching game logic or UI.

### 2.1 Module Diagram

```
┌──────────┐    player actions     ┌──────────────────┐    INetworkAdapter    ┌─────────────┐
│          │ ───────────────────►  │                  │ ──────────────────►  │             │
│    UI    │                       │  Core Game Engine │                       │   Network   │
│          │ ◄───────────────────  │                  │ ◄──────────────────  │             │
└──────────┘    GameState updates  └──────────────────┘    state sync         └─────────────┘
```

- **UI → Core:** "Player wants to deploy card X at slot 3" (intent)
- **Core → Network:** "Validated action, broadcast to opponent" (via adapter)
- **Network → Core:** "Opponent deployed card Y" (incoming action)
- **Core → UI:** "State updated, re-render" (new GameState)

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
| `engine/PhaseManager` | State machine: BUILDING → PREP → MATCHING → BATTLE_PREP → BATTLE → RESULT                                  |
| `engine/Validator`  | Validates any player action against current state — anti-cheat layer when run server-side                     |

**Interface:** Exposes `applyAction(state, action): GameState` and `resolveLane()`. No side effects, fully testable.

### 2.4 Module 3: Network

Abstracted transport layer. Defines interfaces so the implementation can be swapped without touching game logic or rendering.

| Sub-module             | Responsibility                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `interface/`           | `INetworkAdapter` — `connect()`, `sendAction()`, `onStateUpdate()`, `onLaneReveal()`, etc.            |
| `adapters/colyseus/`   | Central server adapter — authoritative Colyseus rooms, schema sync, room-based matchmaking             |
| `adapters/p2p/`        | (Future) P2P adapter — WebRTC DataChannels, one peer acts as host running the Core Engine              |
| `server/BattleRoom`    | Colyseus `Room` subclass — match lifecycle, visibility filtering, phase timers                         |
| `messages/`            | Typed message definitions shared by all adapters                                                       |

**Matchmaking:** Room-based — players within the same room are matched against each other. No global queue. The room handles pairing when enough players are present.

**Interface:** UI and Core Engine interact with Network only through `INetworkAdapter`. Swapping from Colyseus to P2P requires zero changes to game logic or rendering.

---

## 3. Authority Model

The server (or host peer in P2P) is the single source of truth. The client is a view layer that sends intents and renders confirmed state.

### Server / Host owns

| Concern                | Detail                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Card resolution        | All lane outcomes computed via `shared/rules/lane`                 |
| Visibility enforcement | Hidden card data never sent to opponent until reveal time          |
| Deploy validation      | Every placement checked against zone rules and deck contents       |
| Economy validation     | Draft picks, discards, upgrades validated against phase rules      |
| Timers                 | Phase duration enforced; auto-advance on timeout                   |
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

### 4.1 Match Lifecycle

```
Client A              Server / Host          Client B
   │                       │                      │
   ├──joinRoom()──────────►│◄────joinRoom()───────┤
   │                       │                      │
   │               [room pairs A + B]             │
   │                       │                      │
   │◄──matchStarted───────►│◄────matchStarted────►│
   │                       │                      │
   │    ═══ BUILDING PHASE (rounds 1-3) ═══       │
   │                       │                      │
   │◄──draftChoices(3)─────│──draftChoices(3)────►│
   ├──pickCard(id)────────►│◄────pickCard(id)─────┤
   │◄──deckUpdate──────────│──deckUpdate─────────►│
   │       ... repeat per pick ...                │
   │                       │                      │
   │    ═══ PREPARATION PHASE ═══                 │
   │                       │                      │
   ├──deployCard(slot)────►│  (validate)          │
   │◄──stateSync───────────│                      │
   │                       │──opponentPartial────►│
   │                       │  (frontier = full,    │
   │                       │   shadow = type only,  │
   │                       │   battlePrep = hidden) │
   ├──ready()─────────────►│◄────ready()──────────┤
   │                       │                      │
   │    ═══ BATTLE PHASE (lane-by-lane) ═══       │
   │                       │                      │
   │               [resolve lane 1]               │
   │◄──laneReveal(1)──────│──laneReveal(1)───────►│
   │  {cardA, cardB,       │                      │
   │   result, hpDelta}    │                      │
   │       ... lanes 2-7 ...                      │
   │                       │                      │
   │◄──battleResult────────│──battleResult────────►│
   │  {winner, trophies}   │                      │
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

```
Server full state
  ├─► Player A view: own cards (full) + opponent Frontier (full)
  │                                    + opponent Shadow (type only)
  │                                    + opponent Battle Prep (NOTHING)
  │
  └─► Player B view: (mirror of above)
```

Opponent card IDs and stats in Shadow/BattlePrep zones are **never serialized to the wire**. This is the primary anti-cheat boundary.

---

## 5. State Schema

```
GameState
├── phase: Phase (BUILDING | PREP | BATTLE_PREP | BATTLE | RESULT)
├── round: number
├── players: Map<string, PlayerState>
│   └── PlayerState
│       ├── hp: number
│       ├── trophies: number
│       ├── deck: Card[9]            ← full deck (server-only for opponent)
│       ├── deployed: Card[7]        ← ordered lane assignments
│       ├── zones
│       │   ├── frontier: [0, 1, 2]
│       │   ├── shadow: [3, 4, 5]
│       │   └── battlePrep: [6]
│       └── reserve: Card[]
├── lanes: LaneState[7]
│   └── LaneState
│       ├── resolved: boolean
│       ├── cardA: CardId | null
│       ├── cardB: CardId | null
│       └── result: LaneResult | null
└── timers
    └── phaseEnd: timestamp
```

---

## 6. Build & Dev Workflow

### Directory Layout

```
some-cool-game/
├── packages/
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
| `pnpm dev`   | Starts all three packages (shared watch + server + client)      |
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
