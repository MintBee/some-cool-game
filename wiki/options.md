# 3 MVP Implementation Options

> **Constraint:** All 3 options conform to the same game specs (GDD v4.0, Card Design, Technical Spec). The divergence is in **how we build toward the first playable version**, not in game rules or tech stack.
>
> All options use: TypeScript, PixiJS 8, Preact + HTM, Colyseus, Turborepo + pnpm, Vitest, Biome.

---

## Option A: "Server-First" — Multiplayer from Day 1

**Philosophy:** Build the authoritative server and networking layer first, then attach a minimal UI.

**Build order:**
1. `shared/` — Core engine: types, card catalog, lane resolution, phase manager, economy rules, deploy validation
2. `server/` — Colyseus BattleRoom with full authority model, visibility filtering, MatchManager with round-robin pairing
3. `client/` — Minimal Preact-only UI (no PixiJS yet) — text-based card display, click-to-deploy, simple HP/trophy counters
4. Replace Preact text UI with PixiJS rendering + card animations

**What you play first:** Two browser tabs connecting to localhost Colyseus server. Text-based cards, functional multiplayer. Ugly but real networking from the start.

**Strengths:**
- Networking bugs found early — the hardest part is tackled first
- Visibility filtering (anti-cheat) is built-in from the start
- No throwaway code — everything is production architecture
- State sync issues surface immediately

**Weaknesses:**
- Slowest time to "fun" — need server + client working before you can play at all
- Harder to iterate on game feel when every change touches client + server
- Can't test alone — always need 2 browser tabs minimum

---

## Option B: "Engine-First" — Local Hot-Seat Prototype

**Philosophy:** Build the pure game engine and a local 2-player mode (same screen, alternating turns). Layer networking on later.

**Build order:**
1. `shared/` — Core engine (same as Option A)
2. `client/` — Full PixiJS rendering with local-only game loop — two players share one screen, alternating prep phases with a "pass the screen" flow
3. Battle phase plays out with full poker-style lane reveals and animations
4. `server/` — Wire up Colyseus, replace local game loop with network adapter

**What you play first:** A single browser window where two players take turns on the same machine. Full card art (placeholder shapes), animations, drag-to-deploy. No networking.

**Strengths:**
- Fastest time to "feels like a game" — card animations, reveals, and game flow are tangible quickly
- Game logic is proven correct before networking adds complexity
- Easy to demo and get feedback on card interactions and balance
- One person can playtest both sides

**Weaknesses:**
- Hot-seat UX is throwaway (no "pass the screen" in final game)
- Visibility zones are awkward locally (both players see same screen)
- Risk of building client-authoritative habits that need refactoring for server authority
- Networking integration is deferred — could reveal architectural issues late

---

## Option C: "Bot-First" — Single-Player vs AI

**Philosophy:** Build a single-player experience against a simple AI opponent. The AI uses the same Core Engine, validating game logic through adversarial play.

**Build order:**
1. `shared/` — Core engine + a simple AI module (`engine/BotPlayer`) that makes legal random/heuristic moves
2. `client/` — Full PixiJS UI, but opponent is the local bot — no networking needed
3. AI plays instantly or with a small delay, full poker-style reveal plays out
4. `server/` — Replace bot with Colyseus network adapter; bot module stays as an optional PvE mode

**What you play first:** A single browser window where you play against a bot that makes random legal moves. Full UI, proper visibility (you only see your own cards + opponent's Frontier), instant games.

**Strengths:**
- Fastest solo iteration — play full games alone, rapidly test card interactions
- Visibility zones work naturally (bot's cards are hidden from you, just like multiplayer)
- Bot becomes a permanent feature (PvE practice mode) — zero throwaway code
- Excellent for balance testing — can run hundreds of bot-vs-bot simulations later
- Core engine gets stress-tested by adversarial AI moves

**Weaknesses:**
- AI behavior (even random) can mask game design issues that only emerge with human opponents
- Risk of optimizing for PvE feel when the real game is PvP
- Networking integration still deferred (same risk as Option B)
- Bot module is extra code to maintain

---

## Summary Comparison

| Aspect | A: Server-First | B: Hot-Seat | C: Bot-First |
|---|---|---|---|
| Time to first playable | Slowest | Medium | Fastest |
| Multiplayer ready | Immediately | Last | Last |
| Solo testable | No (need 2 tabs) | Yes (awkward) | Yes (natural) |
| Throwaway code | None | Hot-seat UX | None (bot stays) |
| Visibility zones | Correct from start | Broken locally | Correct from start |
| Balance testing | Manual 2-player | Manual 2-player | Automated possible |
| Risk | Frontend delayed | Late networking bugs | PvE ≠ PvP feel |

---

## Shared First Step (All Options)

All 3 options start with the same `shared/` package:
- `packages/shared/src/types/` — Card, GameState, PlayerState, Phase, Tier, etc.
- `packages/shared/src/cards/catalog.ts` — 22-card catalog with tier scaling
- `packages/shared/src/cards/abilities.ts` — Pure ability effect functions
- `packages/shared/src/rules/lane.ts` — `resolveLane()` with priority ordering
- `packages/shared/src/rules/economy.ts` — Phase transitions and validation
- `packages/shared/src/rules/deploy.ts` — Zone constraints, contiguous placement
- `packages/shared/src/engine/PhaseManager.ts` — State machine
- `packages/shared/src/engine/MatchManager.ts` — Round-robin, trophies, lobby
- `packages/shared/src/engine/Validator.ts` — Action validation

The monorepo scaffold (turbo.json, workspace package.json, tsconfig, Biome config) is also identical across all 3.
