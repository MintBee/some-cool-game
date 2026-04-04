import {
	BATTLE_PREP_TIMER_MS,
	LANE_COUNT,
	PREP_TIMER_MS,
	STARTING_HP,
	getDeployLimits,
} from "../config.js";
import type { Card } from "../types/card.js";
import type { CarryOverState, GameState, LaneState, PlayerState } from "../types/game.js";
import { Phase } from "../types/game.js";

export function createInitialGameState(
	playerAId: string,
	playerBId: string,
	round: number,
	existingDecks?: [Card[], Card[]],
): GameState {
	const limits = getDeployLimits(round);
	const maxSlots = limits.frontier + limits.shadow + limits.battlePrep;

	const createPlayer = (id: string, deck: Card[]): PlayerState => ({
		id,
		hp: STARTING_HP,
		trophies: 0,
		deck,
		deployed: Array(maxSlots).fill(null),
		reserve: [...deck],
		zones: { frontier: [], shadow: [], battlePrep: [] },
		ready: false,
	});

	return {
		phase: Phase.Building,
		round,
		players: [
			createPlayer(playerAId, existingDecks?.[0] ?? []),
			createPlayer(playerBId, existingDecks?.[1] ?? []),
		],
		lanes: createLanes(LANE_COUNT),
		timers: { phaseEnd: 0 },
		carryOver: {
			shields: [0, 0],
			buffs: [[], []],
		},
	};
}

function createLanes(count: number): LaneState[] {
	return Array.from({ length: count }, (_, i) => ({
		index: i,
		resolved: false,
		cardA: null,
		cardB: null,
		result: null,
	}));
}

export function advancePhase(state: GameState): GameState {
	const nextPhase = getNextPhase(state.phase, state.round);
	if (!nextPhase) return state;

	const now = Date.now();
	let timerMs = 0;

	switch (nextPhase) {
		case Phase.Prep:
			timerMs = PREP_TIMER_MS;
			break;
		case Phase.BattlePrep:
			timerMs = BATTLE_PREP_TIMER_MS;
			break;
	}

	return {
		...state,
		phase: nextPhase,
		players: [
			{ ...state.players[0], ready: false },
			{ ...state.players[1], ready: false },
		],
		timers: { phaseEnd: timerMs > 0 ? now + timerMs : 0 },
		// Reset lanes and carry-over when entering Battle phase
		...(nextPhase === Phase.Battle
			? {
					lanes: createLanes(LANE_COUNT),
					carryOver: { shields: [0, 0], buffs: [[], []] } as CarryOverState,
				}
			: {}),
	};
}

function getNextPhase(current: Phase, round: number): Phase | null {
	switch (current) {
		case Phase.Building:
			return Phase.Prep;
		case Phase.Prep:
			return Phase.Matching;
		case Phase.Matching:
			return round >= 3 ? Phase.BattlePrep : Phase.Battle;
		case Phase.BattlePrep:
			return Phase.Battle;
		case Phase.Battle:
			return Phase.Result;
		case Phase.Result:
			return null; // Match manager handles transition to next round
	}
}

export function isPhaseComplete(state: GameState): boolean {
	switch (state.phase) {
		case Phase.Building:
			// Both players have finished their picks (deck size matches expected)
			return state.players.every((p) => p.ready);
		case Phase.Prep:
			return state.players.every((p) => p.ready);
		case Phase.Matching:
			// Auto-advance (matchmaking is instant for MVP)
			return true;
		case Phase.BattlePrep:
			return state.players.every((p) => p.ready);
		case Phase.Battle:
			return state.lanes.every((l) => l.resolved);
		case Phase.Result:
			return true;
	}
}

/** Populate lane card references from deployed arrays */
export function populateLanes(state: GameState): GameState {
	const lanes = state.lanes.map((lane, i) => ({
		...lane,
		cardA: state.players[0].deployed[i]?.id ?? null,
		cardB: state.players[1].deployed[i]?.id ?? null,
	}));
	return { ...state, lanes };
}
