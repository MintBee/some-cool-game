import { describe, expect, it } from "vitest";
import { TROPHIES_TO_WIN } from "../../config.js";
import { applyBattleResult, createMatch, getCurrentPairing, lockMatch } from "../MatchManager.js";

describe("MatchManager", () => {
	it("creates a match with zero wins", () => {
		const match = createMatch("test-1", ["alice", "bob"]);
		expect(match.matchId).toBe("test-1");
		expect(match.players).toEqual(["alice", "bob"]);
		expect(match.locked).toBe(false);
		expect(match.wins.alice).toBe(0);
		expect(match.wins.bob).toBe(0);
		expect(match.matchOver).toBe(false);
	});

	it("locks the match", () => {
		const match = lockMatch(createMatch("test-1", ["alice", "bob"]));
		expect(match.locked).toBe(true);
	});

	it("awards trophy on KO (opponent HP → 0)", () => {
		let match = lockMatch(createMatch("test-1", ["alice", "bob"]));
		match = applyBattleResult(match, {
			hpA: 15,
			hpB: 0,
			playerAId: "alice",
			playerBId: "bob",
		});
		expect(match.wins.alice).toBe(1);
		expect(match.wins.bob).toBe(0);
	});

	it("awards trophy on HP lead", () => {
		let match = lockMatch(createMatch("test-1", ["alice", "bob"]));
		match = applyBattleResult(match, {
			hpA: 10,
			hpB: 20,
			playerAId: "alice",
			playerBId: "bob",
		});
		expect(match.wins.alice).toBe(0);
		expect(match.wins.bob).toBe(1);
	});

	it("no trophy on double KO", () => {
		let match = lockMatch(createMatch("test-1", ["alice", "bob"]));
		match = applyBattleResult(match, {
			hpA: 0,
			hpB: 0,
			playerAId: "alice",
			playerBId: "bob",
		});
		expect(match.wins.alice).toBe(0);
		expect(match.wins.bob).toBe(0);
	});

	it("no trophy on equal HP", () => {
		let match = lockMatch(createMatch("test-1", ["alice", "bob"]));
		match = applyBattleResult(match, {
			hpA: 15,
			hpB: 15,
			playerAId: "alice",
			playerBId: "bob",
		});
		expect(match.wins.alice).toBe(0);
		expect(match.wins.bob).toBe(0);
	});

	it("match ends at 10 trophies", () => {
		let match = lockMatch(createMatch("test-1", ["alice", "bob"]));
		// Simulate 10 wins for alice
		for (let i = 0; i < TROPHIES_TO_WIN; i++) {
			match = applyBattleResult(match, {
				hpA: 20,
				hpB: 0,
				playerAId: "alice",
				playerBId: "bob",
			});
		}
		expect(match.matchOver).toBe(true);
		expect(match.winner).toBe("alice");
		expect(match.wins.alice).toBe(10);
	});

	it("generates round-robin pairing for 2 players", () => {
		const match = createMatch("test-1", ["alice", "bob"]);
		const pairing = getCurrentPairing(match);
		expect(pairing).toEqual(["alice", "bob"]);
	});

	it("generates round-robin pairing for 4 players", () => {
		const match = createMatch("test-1", ["a", "b", "c", "d"]);
		expect(match.pairingSchedule.length).toBeGreaterThanOrEqual(3);
		// Every player should face every other player
		const pairSet = new Set(match.pairingSchedule.map(([a, b]) => [a, b].sort().join("-")));
		expect(pairSet.size).toBe(6); // C(4,2) = 6 unique pairings
	});
});
