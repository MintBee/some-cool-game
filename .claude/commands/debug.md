# /debug — Systematic Bug Investigation

A structured debugging approach derived from live play-testing sessions on this codebase.
Use this when you encounter a bug and aren't sure where to start.

---

## Phase 1 — Classify the Bug

Before reading any code, classify what kind of bug it is.
This determines which data path to trace.

| Symptom | Bug Class | Where to start |
|---------|-----------|----------------|
| Counter/value stuck at 0 or initial value | **State mutation missing** | Find where value *should* change; check if the mutation is called |
| UI element doesn't appear | **Phase-gated render** | Check conditional in the component (`phase === "X"` may be incomplete) |
| Works for host, broken for non-host | **Authority model split** | Trace host path vs non-host path separately |
| Crashes with "cannot read X of undefined" | **Type/shape mismatch** | Something is cast as a type it isn't — find the cast |
| Feature exists but nothing happens | **Dead code path** | Confirm the function is actually called; trace from user action to handler |
| State resets on round/session boundary | **Cross-boundary persistence** | Find what creates the new state; check what it preserves vs resets |
| Visual appears then disappears | **Self-destructing side effect** | Check for `.remove()` calls inside animations; add persistent elements |

---

## Phase 2 — Trace the Data Path

For any value that's wrong, trace its complete journey:

```
Source (where created) → Transform (where modified) → Sink (where consumed/displayed)
```

**In this codebase:**

```
GameState (shared/engine)
  → filterStateForPlayer()     ← anti-cheat boundary; shape changes here
  → VisibleGameState
  → deriveViewModelFromVisible() / deriveViewModel()
  → BoardViewModel
  → Preact component (HpBar, TrophyCounter, etc.)
  → SVG via SvgRenderer.updateBoard()
```

For P2P specifically, trace the **split path**:

```
Host:
  GameState → HostEngine.onStateChange(rawState) → deriveViewModel(rawState, pid)

Non-host:
  GameState → filterStateForPlayer() → VisibleGameState
           → sendToPlayer() → DataChannel → P2PAdapter.messageCallbacks
           → "stateSync" handler → deriveViewModelFromVisible(visible)
```

**Ah-ha moment rule:** If the value is correct at step N but wrong at step N+1, the bug is at the transform between them. Read that transform.

---

## Phase 3 — Check for Dead Code Paths

Before assuming a function is broken, confirm it is actually *called*.

**How to check:**
1. Find the function (e.g., `animateLaneReveal`)
2. Grep for call sites: does anything actually invoke it?
3. If no call sites: the feature was built but never wired up — the fix is wiring, not fixing the function

**Known dead paths in this repo:**
- `Animator.animateLaneReveal()` — never called from App/MockGame; visual lane results go through `SvgRenderer.updateBoard()` instead
- `MatchManager.applyBattleResult()` — not called from MockGame; MockGame does trophy math itself
- `HostEngine.broadcastState()` was never called during Building phase — draft choices were sent but game board never rendered (fixed: added call after sending initial drafts)

---

## Phase 4 — Identify the Fix Location

Once you know *what* is wrong, determine *where* the fix belongs:

| Problem | Wrong fix location | Correct fix location |
|---------|-------------------|---------------------|
| Value never set | Fix the display component | Fix where the value is **mutated** |
| UI missing in a phase | Add special case in render | Add the phase to the `showX` condition |
| State lost across rounds | Fix round-start code | Save state **before** round-start, restore in `createInitialGameState` |
| Non-host gets wrong data | Fix HostEngine | Fix the `sendToPlayer` or `filterStateForPlayer` path |
| Animation shows then vanishes | Fix animation timing | Add a **persistent** element alongside the transient one |

---

## Phase 5 — Verify Against the Spec

After fixing, check the GDD (`wiki/GDD.md`) for the invariant, not just the symptom.

Example:
- Symptom: "Trophies don't increment"
- Fix verified: `applyBattleResult` called
- Spec check: Confirm tie/double-KO = no trophy; KO = trophy; higher HP = trophy (GDD 1.2)

---

## Phase 6 — Write Regression Tests at the Invariant Level

Don't test the fix itself — test the **game rule** the fix restores.

**Good regression test (tests the invariant):**
```typescript
it("battle with asymmetric damage yields different HP", () => {
  // Verifies the precondition for trophy logic — not "MockGame awards trophies"
});
```

**Bad regression test (tests the implementation):**
```typescript
it("handleBattle() calls applyBattleResult()", () => {
  // Breaks if the implementation changes even if the bug stays fixed
});
```

Test files:
- Engine invariants: `sources/shared/src/engine/__tests__/regression.test.ts`
- ViewModel derivation: `sources/client/src/state/__tests__/ViewModel.test.ts`

---

## Checklist for P2P-Specific Bugs

When testing multiplayer and something is wrong, go through this list:

- [ ] **Is it host-only or guest-only?** Open DevTools on both windows and compare
- [ ] **Is the action reaching HostEngine?** Add `console.log` in `handleIncomingAction`
- [ ] **Is the state being filtered correctly?** Check `filterStateForPlayer` zone indices
- [ ] **Does the shape match?** `VisibleGameState` has `self`/`opponent`; `GameState` has `players[]` — don't mix them
- [ ] **Is the phase gate correct?** Check all phases a component should be visible in (e.g., `Prep || BattlePrep`)
- [ ] **Is cross-round state persisted?** Deck persists (via `playerDecks` Map in HostEngine); HP resets; trophies tracked in `matchState.wins`
- [ ] **Is the action type right?** Prep = `deployCard`; BattlePrep = `insertBattlePrep` (different validators)
- [ ] **Is the DataChannel open?** Messages sent before `gameChannel.readyState === "open"` are silently dropped unless queued
- [ ] **Are all derived fields updated?** If a mutation updates `deck`, check if `reserve` (= deck minus deployed) also needs updating

---

## Bug Patterns Discovered in P2P Verification (2026-04)

### Pattern: Synchronous Callback Ordering
**Symptom:** Host player sees stale/empty UI after an action, but non-host works fine.
**Cause:** Host delivers messages via `adapter.messageCallbacks` synchronously. If the handler does `setState(newValue)` then the caller does `setState([])` afterward, the clear wins.
**Fix:** Move the clear *before* the synchronous engine call, not after. For async (non-host) paths, clear after sending is fine since the response arrives later.

### Pattern: Missing Derived Field Propagation
**Symptom:** A value is correct in one field but stale/empty in a related field.
**Cause:** `applyPick()` added cards to `deck` but never recalculated `reserve` (which is `deck - deployed`). The HandPanel checked `reserve`, found it empty, and didn't render.
**Rule:** When mutating a source field, grep for all derived fields and update them. In this codebase: `deck` → `reserve`, `deployed` → `zones`.

### Pattern: WebRTC Message Loss on Startup
**Symptom:** Non-host peer stuck on "Setting up game..." despite "Connected (P2P)".
**Cause:** `matchStarted` callback fires → HostEngine created → sends messages immediately. But `setupPeerConnection()` and `createOffer()` run *after* the callback. DataChannel isn't open yet; `sendMessage()` silently drops.
**Fix:** Queue outbound messages in `pendingMessages[]`, flush on `gameChannel.onopen`.

### Pattern: Message Type Confusion in Multiplexed Channels
**Symptom:** `"Invalid action from undefined: Player not found in game"` on host console.
**Cause:** HostEngine registered `adapter.onMessage()` and cast every incoming `GameMessage` as an `Action`. When `sendToPlayer(hostId, draftChoices)` delivered via the same `messageCallbacks` array, the non-Action message was processed as an Action with `playerId: undefined`.
**Fix:** Filter incoming messages by a whitelist of valid action types before calling `handleIncomingAction`.

---

## Preact-Specific Debugging Notes

- **Controlled inputs:** Preact uses `onInput` (not `onChange`). Setting `input.value` via the native setter does NOT update Preact state unless you dispatch an `InputEvent` (not a generic `Event`).
- **HMR and running instances:** Vite HMR replaces the module, but existing class instances (like `HostEngine`) keep the old closure. After editing HostEngine code, you must start a new game — the running instance won't pick up changes.
- **Shared package changes:** Edits to `@game/shared` require `pnpm --filter @game/shared build` (tsc) before the client picks them up via Vite.

---

## Quick Reference: What Persists Across Rounds

| Data | Persists? | How |
|------|-----------|-----|
| Player deck (drafted cards) | Yes | `HostEngine.playerDecks` Map, passed as `existingDecks` to `createInitialGameState` |
| HP | No | Resets to `STARTING_HP` each round |
| Trophies | Yes (match level) | `matchState.wins` in `HostEngine`, sent via `battleResult` message |
| Deployed cards | No | Cleared each round (it's a fresh battle) |
| Reserve cards | No | Derived fresh from deck each round |

---

## Debugging Without a Browser Automation Tool

When you can't control the browser directly:

1. **Fix bugs identified by code review first** — they will definitely block testing
2. **Classify each bug by severity** before starting:
   - *Critical*: blocks the game loop from proceeding (e.g., phase never advances)
   - *Major*: wrong behavior that corrupts state (e.g., host sees opponent cards)
   - *Minor*: cosmetic or informational only (e.g., lobby count shows 0/2)
3. **Fix in priority order**: Critical → Major → Minor
4. **Run `pnpm lint && pnpm test && pnpm build`** after each fix before moving on
5. **Guide the user through manual testing** with an exact step-by-step script
