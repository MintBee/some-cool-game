# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

The repo root must stay clean — only `sources/`, `wiki/`, and git files. All source code and build configs live under `sources/`, which is the pnpm workspace root. Design docs live in `wiki/`.

```
sources/
├── shared/   @game/shared  — Core game engine (pure TS, deterministic, no I/O)
├── server/   @game/server  — WebRTC signaling server (Node.js + ws)
├── client/   @game/client  — UI layer (Preact + SVG + GSAP) + P2P networking
```

## Commands

All commands run from `sources/`:

```bash
cd sources
pnpm install          # install dependencies
pnpm build            # build all (shared → server|client in parallel)
pnpm test             # test all packages
pnpm lint             # biome check
pnpm format           # biome auto-fix
pnpm dev              # start all in watch mode
```

Single-package commands:
```bash
pnpm --filter @game/shared test        # test shared only
pnpm --filter @game/shared test:watch  # vitest watch mode
pnpm --filter @game/server dev         # start signaling server (port 3001)
pnpm --filter @game/client dev         # start vite dev server
```

## Architecture

**Three-module design with clean interfaces** — any module can be swapped independently.

### Module 1: Core Engine (`shared/`)
Pure TypeScript, fully deterministic, zero side effects. Reducer pattern: `applyAction(state, action) → GameState`.

- `types/` — All interfaces: Card, GameState, PlayerState, Phase, Action, GameMessage
- `cards/catalog.ts` — 22-card catalog (4 Disrupt, 4 Shield, 4 Buff, 6 Strike, 4 Nuke)
- `cards/abilities.ts` — Pure ability resolution functions per card type
- `cards/scaling.ts` — `createCard(definition, tier)` creates playable instances
- `rules/lane.ts` — `resolveLane()` handles priority ordering, weaken, shields, buffs, nukes
- `rules/economy.ts` — Building/Replacement/Reinforcement phase logic
- `rules/deploy.ts` — Zone constraints (Frontier→Shadow→BattlePrep), contiguous placement
- `engine/PhaseManager.ts` — State machine: Building→Prep→Matching→BattlePrep→Battle→Result
- `engine/MatchManager.ts` — Round-robin pairing, trophy tracking, first-to-10
- `engine/Validator.ts` — Validates any action against current state
- `visibility.ts` — `filterStateForPlayer()` strips hidden cards (anti-cheat boundary)
- `rng.ts` — Seeded PRNG (mulberry32) for deterministic draft generation

### Module 2: UI (`client/`)
- `renderer/interface.ts` — `IRenderAdapter` abstraction (swappable renderer)
- `renderer/svg/` — SVG + GSAP implementation (viewBox 1400×700)
- `components/` — Preact HUD: HpBar, PhaseIndicator, TrophyCounter, DraftPanel, HandPanel, Lobby
- `state/ViewModel.ts` — Derives display state from GameState with visibility filtering
- `dev/MockGame.tsx` — Dev harness for testing without networking (`?mode=dev`)

### Module 3: Network (`client/network/` + `server/`)
- `P2PAdapter.ts` — WebRTC DataChannels via signaling server; implements `INetworkAdapter`
- `HostEngine.ts` — Host peer runs Core Engine, validates actions, sends filtered state
- `server/SignalingServer.ts` — WebSocket relay for SDP/ICE, room management, host designation

**Authority model:** Host peer is the single source of truth. Non-host peers send intents and render confirmed state. `filterStateForPlayer()` enforces visibility — hidden card data never sent to opponents.

## Key Patterns

- **Lane resolution** iterates lanes 0→6 sequentially; carry-over state (Aegis shield, active Buff effects) flows forward via `LaneContext`
- **Card priority:** Disrupt(P0) → Shield(P1) → Buff(P2) → Strike(P3) → Nuke(P4). Lower activates first.
- **Buff cards** are fragile — broken if they take damage in their own lane
- **Nuke cards** are conditional — deal 0 damage if condition fails
- **Early rounds** have fewer cards: R1=3 (Frontier only), R2=5 (+Shadow), R3+=7 (+BattlePrep). Empty lanes resolve with `result: null`.

## Conventions

- **Formatting:** Biome with tabs, 100-char line width
- **Buttons:** Always include `type="button"` on `<button>` elements
- **SVG:** Use `createElementNS` for SVG elements, `svgOrigin` for transform origins, `attr: {}` wrapper for GSAP SVG attributes, `tl.to({}, { duration })` for gaps (not `addPause()`), tag effects with `data-effect` for cleanup
- **Wiki docs:** `wiki/considerations.md` is for game design decisions only; technical insights go in separate files like `svg_ui_considerations.md`
