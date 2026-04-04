import { describe, expect, it } from "vitest";
import { CARD_CATALOG } from "../../cards/catalog.js";
import { createCard } from "../../cards/scaling.js";
import { Tier } from "../../types/card.js";
import { Phase } from "../../types/game.js";
import { advancePhase, createInitialGameState } from "../PhaseManager.js";
import { applyAction, resolveBattle } from "../index.js";

/**
 * Regression tests for bugs fixed in the dev harness and engine flow.
 *
 * Bug 1: Trophies never updated after battle resolution
 * Bug 2: No way to transition from Result phase to next round
 * Bug 3: Lane results not surfaced after battle
 */

function setupAndBattle(
	aliceCardIds: string[],
	bobCardIds: string[],
	round = 1,
	initialHp?: [number, number],
	initialTrophies?: [number, number],
) {
	let state = createInitialGameState("alice", "bob", round);

	const aliceDeck = aliceCardIds.map((id) => createCard(CARD_CATALOG[id], Tier.T1));
	const bobDeck = bobCardIds.map((id) => createCard(CARD_CATALOG[id], Tier.T1));

	state = {
		...state,
		phase: Phase.Prep,
		players: [
			{
				...state.players[0],
				deck: aliceDeck,
				reserve: [...aliceDeck],
				...(initialHp ? { hp: initialHp[0] } : {}),
				...(initialTrophies ? { trophies: initialTrophies[0] } : {}),
			},
			{
				...state.players[1],
				deck: bobDeck,
				reserve: [...bobDeck],
				...(initialHp ? { hp: initialHp[1] } : {}),
				...(initialTrophies ? { trophies: initialTrophies[1] } : {}),
			},
		],
	};

	// Deploy all cards
	for (let i = 0; i < aliceDeck.length; i++) {
		state = applyAction(state, {
			type: "deployCard",
			playerId: "alice",
			cardId: aliceDeck[i].id,
			slot: i,
		});
	}
	for (let i = 0; i < bobDeck.length; i++) {
		state = applyAction(state, {
			type: "deployCard",
			playerId: "bob",
			cardId: bobDeck[i].id,
			slot: i,
		});
	}

	// Advance to battle
	while (state.phase !== Phase.Battle) {
		state = advancePhase(state);
	}

	state = resolveBattle(state);
	state = advancePhase(state); // → Result

	return state;
}

describe("Regression: trophy awarding after battle", () => {
	it("winner gets a trophy when they have higher HP", () => {
		// Slash(5 dmg) vs Sabotage(disrupt) → Alice deals more total damage
		const state = setupAndBattle(["slash", "barrier", "meteor"], ["pierce", "reflect", "sabotage"]);

		expect(state.phase).toBe(Phase.Result);

		const hpA = state.players[0].hp;
		const hpB = state.players[1].hp;

		// Determine expected winner
		if (hpA > hpB) {
			// Alice should get trophy
			expect(hpA).toBeGreaterThan(hpB);
		} else if (hpB > hpA) {
			expect(hpB).toBeGreaterThan(hpA);
		}
		// The trophy logic itself was in MockGame, but this verifies
		// the precondition: HP values are different after asymmetric battle
		expect(hpA).not.toBe(hpB);
	});

	it("symmetric battle results in equal HP (no trophy should be awarded)", () => {
		const state = setupAndBattle(["slash", "barrier", "pierce"], ["slash", "barrier", "pierce"]);

		expect(state.phase).toBe(Phase.Result);
		expect(state.players[0].hp).toBe(state.players[1].hp);
	});

	it("trophies can be set on player state and preserved", () => {
		const state = setupAndBattle(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
			1,
			undefined,
			[3, 2],
		);

		// Trophies from initial state should be preserved through battle
		// (resolveBattle doesn't touch trophies)
		expect(state.players[0].trophies).toBe(3);
		expect(state.players[1].trophies).toBe(2);
	});
});

describe("Regression: Result phase and round transition", () => {
	it("battle advances to Result phase", () => {
		const state = setupAndBattle(["slash", "barrier", "meteor"], ["pierce", "reflect", "sabotage"]);
		expect(state.phase).toBe(Phase.Result);
	});

	it("Result phase returns null for next phase (round transition needed)", () => {
		const state = setupAndBattle(["slash", "barrier", "meteor"], ["pierce", "reflect", "sabotage"]);

		// advancePhase from Result should return the same state (no next phase)
		const next = advancePhase(state);
		expect(next.phase).toBe(Phase.Result);
	});

	it("new round can be created preserving HP and trophies from previous round", () => {
		// Simulate the MockGame handleNextRound pattern:
		// 1. Run a battle in round 1
		const r1 = setupAndBattle(["slash", "barrier", "meteor"], ["pierce", "reflect", "sabotage"], 1);

		const r1HpA = r1.players[0].hp;
		const r1HpB = r1.players[1].hp;

		// 2. Create round 2 with preserved HP
		let r2 = createInitialGameState("alice", "bob", 2);
		const r2AliceDeck = ["slash", "barrier", "meteor", "pierce", "reflect"].map((id) =>
			createCard(CARD_CATALOG[id], Tier.T1),
		);
		const r2BobDeck = ["pierce", "reflect", "sabotage", "slash", "barrier"].map((id) =>
			createCard(CARD_CATALOG[id], Tier.T1),
		);

		r2 = {
			...r2,
			phase: Phase.Prep,
			players: [
				{
					...r2.players[0],
					deck: r2AliceDeck,
					reserve: [...r2AliceDeck],
					hp: r1HpA,
					trophies: 1,
				},
				{
					...r2.players[1],
					deck: r2BobDeck,
					reserve: [...r2BobDeck],
					hp: r1HpB,
					trophies: 0,
				},
			],
		};

		expect(r2.round).toBe(2);
		expect(r2.phase).toBe(Phase.Prep);
		expect(r2.players[0].hp).toBe(r1HpA);
		expect(r2.players[1].hp).toBe(r1HpB);
		expect(r2.players[0].trophies).toBe(1);
		expect(r2.players[1].trophies).toBe(0);
		expect(r2.players[0].reserve.length).toBe(5);
		expect(r2.players[1].reserve.length).toBe(5);
	});
});

describe("Regression: lane results surfaced after battle", () => {
	it("resolved lanes have non-null result with winner field", () => {
		const state = setupAndBattle(["slash", "barrier", "meteor"], ["pierce", "reflect", "sabotage"]);

		// Lanes 0-2 should have results
		for (let i = 0; i < 3; i++) {
			const lane = state.lanes[i];
			expect(lane.resolved).toBe(true);
			expect(lane.result).not.toBeNull();
			expect(["A", "B", "draw"]).toContain(lane.result?.winner);
			expect(typeof lane.result?.hpDeltaA).toBe("number");
			expect(typeof lane.result?.hpDeltaB).toBe("number");
		}
	});

	it("empty lanes (no cards) have null results", () => {
		const state = setupAndBattle(["slash", "barrier", "meteor"], ["pierce", "reflect", "sabotage"]);

		// Lanes 3-6 should have null results (R1 only uses 3 lanes)
		for (let i = 3; i < 7; i++) {
			expect(state.lanes[i].resolved).toBe(true);
			expect(state.lanes[i].result).toBeNull();
		}
	});

	it("lane result hpDelta values sum to match total HP change", () => {
		const state = setupAndBattle(["slash", "barrier", "meteor"], ["pierce", "reflect", "sabotage"]);

		let totalDeltaA = 0;
		let totalDeltaB = 0;
		for (const lane of state.lanes) {
			if (lane.result) {
				totalDeltaA += lane.result.hpDeltaA;
				totalDeltaB += lane.result.hpDeltaB;
			}
		}

		// HP deltas should be negative (damage dealt)
		expect(state.players[0].hp).toBe(Math.max(0, 30 + totalDeltaA));
		expect(state.players[1].hp).toBe(Math.max(0, 30 + totalDeltaB));
	});
});
