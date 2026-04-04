import { describe, expect, it } from "vitest";
import { CARD_CATALOG } from "../../cards/catalog.js";
import { createCard } from "../../cards/scaling.js";
import { Tier } from "../../types/card.js";
import { Phase } from "../../types/game.js";
import { advancePhase, createInitialGameState, isPhaseComplete } from "../PhaseManager.js";
import { applyAction, resolveBattle } from "../index.js";

describe("Engine Integration", () => {
	it("full game flow: create state → deploy → resolve battle", () => {
		// Create a game at round 1 (3 frontier cards each)
		let state = createInitialGameState("alice", "bob", 1);
		expect(state.phase).toBe(Phase.Building);
		expect(state.players[0].hp).toBe(30);
		expect(state.players[1].hp).toBe(30);

		// Give players pre-built decks (skip building phase)
		const aliceDeck = [
			createCard(CARD_CATALOG.slash, Tier.T1),
			createCard(CARD_CATALOG.barrier, Tier.T1),
			createCard(CARD_CATALOG.meteor, Tier.T1),
		];
		const bobDeck = [
			createCard(CARD_CATALOG.slash, Tier.T1),
			createCard(CARD_CATALOG.pierce, Tier.T1),
			createCard(CARD_CATALOG.sabotage, Tier.T1),
		];

		state = {
			...state,
			players: [
				{
					...state.players[0],
					deck: aliceDeck,
					reserve: [...aliceDeck],
				},
				{
					...state.players[1],
					deck: bobDeck,
					reserve: [...bobDeck],
				},
			],
		};

		// Move to prep phase
		state = advancePhase(state);
		expect(state.phase).toBe(Phase.Prep);

		// Alice deploys: Slash at 0, Barrier at 1, Meteor at 2
		state = applyAction(state, {
			type: "deployCard",
			playerId: "alice",
			cardId: aliceDeck[0].id,
			slot: 0,
		});
		state = applyAction(state, {
			type: "deployCard",
			playerId: "alice",
			cardId: aliceDeck[1].id,
			slot: 1,
		});
		state = applyAction(state, {
			type: "deployCard",
			playerId: "alice",
			cardId: aliceDeck[2].id,
			slot: 2,
		});

		// Bob deploys: Slash at 0, Pierce at 1, Sabotage at 2
		state = applyAction(state, {
			type: "deployCard",
			playerId: "bob",
			cardId: bobDeck[0].id,
			slot: 0,
		});
		state = applyAction(state, {
			type: "deployCard",
			playerId: "bob",
			cardId: bobDeck[1].id,
			slot: 1,
		});
		state = applyAction(state, {
			type: "deployCard",
			playerId: "bob",
			cardId: bobDeck[2].id,
			slot: 2,
		});

		// Both ready
		state = applyAction(state, { type: "ready", playerId: "alice" });
		state = applyAction(state, { type: "ready", playerId: "bob" });
		expect(isPhaseComplete(state)).toBe(true);

		// Skip to battle (R1 has no BattlePrep)
		state = advancePhase(state); // Matching
		state = advancePhase(state); // Battle (skips BattlePrep since round < 3)

		expect(state.phase).toBe(Phase.Battle);

		// Resolve battle
		state = resolveBattle(state);

		// All 3 lanes should be resolved (only 3 cards in R1)
		const resolvedLanes = state.lanes.filter((l) => l.resolved);
		expect(resolvedLanes.length).toBe(7); // All 7 marked resolved, but 4-6 have no cards

		// Verify HP changed
		// Lane 0: Slash(5) vs Slash(5) → -5 each → 25/25
		// Lane 1: Barrier(6abs) vs Pierce(4, ignores 50% shield) → eff shield 3, 1 through to Alice → 24/25
		// Lane 2: Meteor(10 if no shield) vs Sabotage(30% weaken)
		//   Sabotage activates first (P0), weakens Meteor damage by 30%
		//   Meteor condition: opponent is Disrupt (not Shield) → true
		//   Weakened damage: floor(10 * 0.7) = 7 → Bob takes -7 → 24/18
		expect(state.players[0].hp).toBeLessThan(30);
		expect(state.players[1].hp).toBeLessThan(30);
	});

	it("deterministic: same inputs produce same outputs", () => {
		const run = () => {
			let state = createInitialGameState("alice", "bob", 1);
			const aliceDeck = [createCard(CARD_CATALOG.slash, Tier.T1)];
			const bobDeck = [createCard(CARD_CATALOG.slash, Tier.T1)];

			state = {
				...state,
				players: [
					{ ...state.players[0], deck: aliceDeck, reserve: [...aliceDeck] },
					{ ...state.players[1], deck: bobDeck, reserve: [...bobDeck] },
				],
			};

			state = advancePhase(state);
			state = applyAction(state, {
				type: "deployCard",
				playerId: "alice",
				cardId: aliceDeck[0].id,
				slot: 0,
			});
			state = applyAction(state, {
				type: "deployCard",
				playerId: "bob",
				cardId: bobDeck[0].id,
				slot: 0,
			});
			state = applyAction(state, { type: "ready", playerId: "alice" });
			state = applyAction(state, { type: "ready", playerId: "bob" });
			state = advancePhase(state);
			state = advancePhase(state);
			return resolveBattle(state);
		};

		const result1 = run();
		const result2 = run();
		expect(result1.players[0].hp).toBe(result2.players[0].hp);
		expect(result1.players[1].hp).toBe(result2.players[1].hp);
	});

	it("R1: only 3 frontier cards, lanes 4-7 are empty and skipped", () => {
		let state = createInitialGameState("alice", "bob", 1);

		const aliceDeck = [
			createCard(CARD_CATALOG.slash, Tier.T1),
			createCard(CARD_CATALOG.barrier, Tier.T1),
			createCard(CARD_CATALOG.pierce, Tier.T1),
		];
		const bobDeck = [
			createCard(CARD_CATALOG.slash, Tier.T1),
			createCard(CARD_CATALOG.slash, Tier.T2),
			createCard(CARD_CATALOG.drain, Tier.T1),
		];

		state = {
			...state,
			players: [
				{ ...state.players[0], deck: aliceDeck, reserve: [...aliceDeck] },
				{ ...state.players[1], deck: bobDeck, reserve: [...bobDeck] },
			],
		};

		state = advancePhase(state); // → Prep

		// Deploy 3 cards each (R1 max)
		for (let i = 0; i < 3; i++) {
			state = applyAction(state, {
				type: "deployCard",
				playerId: "alice",
				cardId: aliceDeck[i].id,
				slot: i,
			});
			state = applyAction(state, {
				type: "deployCard",
				playerId: "bob",
				cardId: bobDeck[i].id,
				slot: i,
			});
		}

		state = applyAction(state, { type: "ready", playerId: "alice" });
		state = applyAction(state, { type: "ready", playerId: "bob" });

		state = advancePhase(state); // → Matching
		state = advancePhase(state); // → Battle (R1 < 3, skips BattlePrep)
		expect(state.phase).toBe(Phase.Battle);

		state = resolveBattle(state);

		// All 7 lanes should be marked resolved
		expect(state.lanes.every((l) => l.resolved)).toBe(true);

		// Lanes 0-2 should have results
		for (let i = 0; i < 3; i++) {
			expect(state.lanes[i].result).not.toBeNull();
		}
		// Lanes 3-6 should have null results (empty)
		for (let i = 3; i < 7; i++) {
			expect(state.lanes[i].result).toBeNull();
		}

		// HP should have changed (at least from the 3 lanes that resolved)
		expect(state.players[0].hp + state.players[1].hp).toBeLessThan(60);
	});

	it("R2: 5 cards deployed (3 frontier + 2 shadow)", () => {
		let state = createInitialGameState("alice", "bob", 2);

		const makeDeck = (ids: string[]) => ids.map((id) => createCard(CARD_CATALOG[id], Tier.T1));
		const aliceDeck = makeDeck(["slash", "barrier", "pierce", "drain", "meteor"]);
		const bobDeck = makeDeck(["slash", "reflect", "sabotage", "twinStrike", "ambush"]);

		state = {
			...state,
			players: [
				{ ...state.players[0], deck: aliceDeck, reserve: [...aliceDeck] },
				{ ...state.players[1], deck: bobDeck, reserve: [...bobDeck] },
			],
		};

		state = advancePhase(state); // → Prep

		// Deploy 5 cards each (R2: 3 frontier + 2 shadow)
		for (let i = 0; i < 5; i++) {
			state = applyAction(state, {
				type: "deployCard",
				playerId: "alice",
				cardId: aliceDeck[i].id,
				slot: i,
			});
			state = applyAction(state, {
				type: "deployCard",
				playerId: "bob",
				cardId: bobDeck[i].id,
				slot: i,
			});
		}

		state = applyAction(state, { type: "ready", playerId: "alice" });
		state = applyAction(state, { type: "ready", playerId: "bob" });

		state = advancePhase(state); // Matching
		state = advancePhase(state); // Battle (R2 < 3, skips BattlePrep)

		state = resolveBattle(state);

		// Lanes 0-4 resolved with results, lanes 5-6 empty
		for (let i = 0; i < 5; i++) {
			expect(state.lanes[i].result).not.toBeNull();
		}
		for (let i = 5; i < 7; i++) {
			expect(state.lanes[i].result).toBeNull();
		}
	});

	it("symmetric battle: equal cards deal equal damage", () => {
		let state = createInitialGameState("alice", "bob", 1);

		// Use T3 Slash (9 dmg) for all — each player gets same total damage
		const aliceDeck = [
			createCard(CARD_CATALOG.slash, Tier.T3), // 9 dmg
			createCard(CARD_CATALOG.pierce, Tier.T3), // 7 dmg
			createCard(CARD_CATALOG.drain, Tier.T3), // 6 dmg + 4 heal
		];
		const bobDeck = [
			createCard(CARD_CATALOG.slash, Tier.T3), // 9 dmg
			createCard(CARD_CATALOG.pierce, Tier.T3), // 7 dmg
			createCard(CARD_CATALOG.drain, Tier.T3), // 6 dmg + 4 heal
		];

		state = {
			...state,
			players: [
				{ ...state.players[0], deck: aliceDeck, reserve: [...aliceDeck] },
				{ ...state.players[1], deck: bobDeck, reserve: [...bobDeck] },
			],
		};

		state = advancePhase(state);
		for (let i = 0; i < 3; i++) {
			state = applyAction(state, {
				type: "deployCard",
				playerId: "alice",
				cardId: aliceDeck[i].id,
				slot: i,
			});
			state = applyAction(state, {
				type: "deployCard",
				playerId: "bob",
				cardId: bobDeck[i].id,
				slot: i,
			});
		}
		state = applyAction(state, { type: "ready", playerId: "alice" });
		state = applyAction(state, { type: "ready", playerId: "bob" });
		state = advancePhase(state);
		state = advancePhase(state);

		state = resolveBattle(state);

		// Symmetric battle: both players should end with equal HP
		expect(state.players[0].hp).toBe(state.players[1].hp);
		// Both took damage
		expect(state.players[0].hp).toBeLessThan(30);
	});
});
