import {
	CARD_CATALOG,
	Phase,
	Tier,
	advancePhase,
	applyAction,
	createCard,
	createInitialGameState,
	resolveBattle,
} from "@game/shared";
import { describe, expect, it } from "vitest";
import { deriveViewModel } from "../ViewModel.js";

/**
 * Regression tests for ViewModel derivation — ensures trophies and lane results
 * are correctly surfaced to the UI layer after battle resolution.
 */

function buildBattleResult(
	aliceCardIds: string[],
	bobCardIds: string[],
	trophies: [number, number] = [0, 0],
) {
	let state = createInitialGameState("alice", "bob", 1);

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
				trophies: trophies[0],
			},
			{
				...state.players[1],
				deck: bobDeck,
				reserve: [...bobDeck],
				trophies: trophies[1],
			},
		],
	};

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

	while (state.phase !== Phase.Battle) {
		state = advancePhase(state);
	}

	state = resolveBattle(state);
	state = advancePhase(state); // → Result
	return state;
}

describe("ViewModel: trophy display after battle", () => {
	it("surfaces trophy counts from player state", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
			[3, 1],
		);

		const vm = deriveViewModel(state, "alice");
		expect(vm.myTrophies).toBe(3);
		expect(vm.opponentTrophies).toBe(1);
	});

	it("surfaces zero trophies at game start", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
			[0, 0],
		);

		const vm = deriveViewModel(state, "alice");
		expect(vm.myTrophies).toBe(0);
		expect(vm.opponentTrophies).toBe(0);
	});

	it("trophy counts are player-relative", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
			[5, 2],
		);

		const vmAlice = deriveViewModel(state, "alice");
		const vmBob = deriveViewModel(state, "bob");

		expect(vmAlice.myTrophies).toBe(5);
		expect(vmAlice.opponentTrophies).toBe(2);
		expect(vmBob.myTrophies).toBe(2);
		expect(vmBob.opponentTrophies).toBe(5);
	});
});

describe("ViewModel: lane results after battle", () => {
	it("resolved lanes have result with winner in ViewModel", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
		);

		const vm = deriveViewModel(state, "alice");

		// Lanes 0-2 should have results
		for (let i = 0; i < 3; i++) {
			expect(vm.lanes[i].resolved).toBe(true);
			expect(vm.lanes[i].result).not.toBeNull();
			expect(["A", "B", "draw"]).toContain(vm.lanes[i].result?.winner);
		}
	});

	it("empty lanes have null results in ViewModel", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
		);

		const vm = deriveViewModel(state, "alice");

		// Lanes 3-6 should be empty
		for (let i = 3; i < 7; i++) {
			expect(vm.lanes[i].result).toBeNull();
		}
	});

	it("lane results include hpDelta values", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
		);

		const vm = deriveViewModel(state, "alice");

		for (let i = 0; i < 3; i++) {
			const result = vm.lanes[i].result;
			expect(result).not.toBeNull();
			expect(typeof result?.hpDeltaA).toBe("number");
			expect(typeof result?.hpDeltaB).toBe("number");
		}
	});

	it("phase shows Result after battle", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
		);

		const vm = deriveViewModel(state, "alice");
		expect(vm.phase).toBe("Result");
	});

	it("HP values in ViewModel match state after battle", () => {
		const state = buildBattleResult(
			["slash", "barrier", "meteor"],
			["pierce", "reflect", "sabotage"],
		);

		const vm = deriveViewModel(state, "alice");
		expect(vm.myHp).toBe(state.players[0].hp);
		expect(vm.opponentHp).toBe(state.players[1].hp);
		expect(vm.myHp).toBeLessThan(30);
		expect(vm.opponentHp).toBeLessThan(30);
	});
});
