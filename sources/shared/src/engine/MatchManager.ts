import { TROPHIES_TO_WIN } from "../config.js";
import type { Card } from "../types/card.js";
import type { GameState } from "../types/game.js";
import type { MatchState } from "../types/match.js";
import { createInitialGameState } from "./PhaseManager.js";

export function createMatch(matchId: string, players: string[]): MatchState {
	const wins: Record<string, number> = {};
	for (const p of players) wins[p] = 0;

	return {
		matchId,
		players,
		locked: false,
		wins,
		matchOver: false,
		winner: null,
		currentBattle: null,
		pairingSchedule: generateRoundRobin(players),
		currentPairingIndex: 0,
	};
}

export function lockMatch(match: MatchState): MatchState {
	return { ...match, locked: true };
}

export function startBattle(
	match: MatchState,
	round: number,
	existingDecks?: [Card[], Card[]],
): MatchState {
	const [playerA, playerB] = getCurrentPairing(match);
	const trophies: [number, number] = [match.wins[playerA] ?? 0, match.wins[playerB] ?? 0];
	const battle = createInitialGameState(playerA, playerB, round, existingDecks, trophies);
	return { ...match, currentBattle: battle };
}

export function getCurrentPairing(match: MatchState): [string, string] {
	const idx = match.currentPairingIndex % match.pairingSchedule.length;
	return match.pairingSchedule[idx];
}

export interface BattleResultData {
	hpA: number;
	hpB: number;
	playerAId: string;
	playerBId: string;
}

export function applyBattleResult(match: MatchState, result: BattleResultData): MatchState {
	const { hpA, hpB, playerAId, playerBId } = result;
	const wins = { ...match.wins };

	// Determine trophy award
	if (hpA <= 0 && hpB <= 0) {
		// Double KO — no trophy
	} else if (hpB <= 0) {
		// Player A KO'd Player B
		wins[playerAId] = (wins[playerAId] ?? 0) + 1;
	} else if (hpA <= 0) {
		// Player B KO'd Player A
		wins[playerBId] = (wins[playerBId] ?? 0) + 1;
	} else if (hpA > hpB) {
		// Player A has higher HP
		wins[playerAId] = (wins[playerAId] ?? 0) + 1;
	} else if (hpB > hpA) {
		// Player B has higher HP
		wins[playerBId] = (wins[playerBId] ?? 0) + 1;
	}
	// Equal HP — no trophy

	// Check win condition
	let matchOver = false;
	let winner: string | null = null;

	const winners = Object.entries(wins).filter(([_, t]) => t >= TROPHIES_TO_WIN);
	if (winners.length > 0) {
		matchOver = true;
		winner = winners.length === 1 ? winners[0][0] : null; // null = shared victory
	}

	return {
		...match,
		wins,
		matchOver,
		winner,
		currentBattle: null,
		currentPairingIndex: match.currentPairingIndex + 1,
	};
}

/** Generate round-robin pairing schedule for all players */
function generateRoundRobin(players: string[]): [string, string][] {
	if (players.length === 2) {
		return [[players[0], players[1]]];
	}

	const schedule: [string, string][] = [];
	const n = players.length;
	// For n players, each round pairs n/2 matches
	// Total rounds = n-1 (each player faces every other)
	const list = [...players];

	for (let round = 0; round < n - 1; round++) {
		for (let i = 0; i < n / 2; i++) {
			schedule.push([list[i], list[n - 1 - i]]);
		}
		// Rotate all except first player
		const last = list.pop() as string;
		list.splice(1, 0, last);
	}

	return schedule;
}
