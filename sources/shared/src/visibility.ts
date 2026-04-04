import type { Card } from "./types/card.js";
import type { GameState, PlayerState } from "./types/game.js";

/** A card as seen by the opponent, with visibility filtering applied */
export type VisibleCard =
	| { visibility: "full"; card: Card }
	| { visibility: "typeOnly"; type: string }
	| { visibility: "hidden" };

export interface VisiblePlayerState {
	id: string;
	hp: number;
	trophies: number;
	deckSize: number;
	deployed: (VisibleCard | null)[];
	reserveSize: number;
}

export interface VisibleGameState {
	phase: string;
	round: number;
	self: PlayerState;
	opponent: VisiblePlayerState;
	lanes: GameState["lanes"];
	timers: GameState["timers"];
}

/**
 * Filter the full GameState to what a specific player is allowed to see.
 * This is the primary anti-cheat boundary.
 */
export function filterStateForPlayer(state: GameState, playerId: string): VisibleGameState {
	const selfIndex = state.players.findIndex((p) => p.id === playerId);
	if (selfIndex === -1) throw new Error(`Player ${playerId} not in game`);

	const self = state.players[selfIndex];
	const opp = state.players[selfIndex === 0 ? 1 : 0];

	const visibleDeployed: (VisibleCard | null)[] = opp.deployed.map((card, i) => {
		if (card === null) return null;

		// Frontier: full visibility
		if (opp.zones.frontier.includes(i)) {
			return { visibility: "full" as const, card };
		}
		// Shadow: type label only
		if (opp.zones.shadow.includes(i)) {
			return { visibility: "typeOnly" as const, type: card.type };
		}
		// Battle Prep: completely hidden
		if (opp.zones.battlePrep.includes(i)) {
			return { visibility: "hidden" as const };
		}
		// Default: hidden
		return { visibility: "hidden" as const };
	});

	return {
		phase: state.phase,
		round: state.round,
		self,
		opponent: {
			id: opp.id,
			hp: opp.hp,
			trophies: opp.trophies,
			deckSize: opp.deck.length,
			deployed: visibleDeployed,
			reserveSize: opp.reserve.length,
		},
		lanes: state.lanes,
		timers: state.timers,
	};
}
