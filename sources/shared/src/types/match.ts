import type { GameState } from "./game.js";

export interface MatchState {
	matchId: string;
	players: string[];
	locked: boolean;
	/** Map of player ID → trophy count */
	wins: Record<string, number>;
	matchOver: boolean;
	winner: string | null;
	currentBattle: GameState | null;
	/** Round-robin pairing schedule: each entry is [playerA, playerB] */
	pairingSchedule: [string, string][];
	currentPairingIndex: number;
}
