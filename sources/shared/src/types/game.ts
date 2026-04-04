import type { Card, CardId } from "./card.js";

export enum Phase {
	Building = "Building",
	Prep = "Prep",
	Matching = "Matching",
	BattlePrep = "BattlePrep",
	Battle = "Battle",
	Result = "Result",
}

export interface GameState {
	phase: Phase;
	round: number;
	players: [PlayerState, PlayerState];
	lanes: LaneState[];
	timers: Timers;
	/** Carry-over effects that persist across lanes within a battle */
	carryOver: CarryOverState;
}

export interface PlayerState {
	id: string;
	hp: number;
	trophies: number;
	deck: Card[];
	deployed: (Card | null)[];
	reserve: Card[];
	zones: Zones;
	ready: boolean;
}

export interface Zones {
	/** Indices into deployed array for Frontier slots (up to 3) */
	frontier: number[];
	/** Indices into deployed array for Shadow slots (up to 3) */
	shadow: number[];
	/** Indices into deployed array for Battle Prep slot (0 or 1) */
	battlePrep: number[];
}

export interface LaneState {
	index: number;
	resolved: boolean;
	cardA: CardId | null;
	cardB: CardId | null;
	result: LaneResult | null;
}

export interface LaneResult {
	winner: "A" | "B" | "draw";
	hpDeltaA: number;
	hpDeltaB: number;
	effects: ResolvedEffect[];
}

export interface ResolvedEffect {
	type: string;
	source: CardId;
	target: CardId | "hp";
	value: number;
	description: string;
}

export interface Timers {
	phaseEnd: number;
}

export interface CarryOverState {
	/** Aegis leftover shield per player: [playerA, playerB] */
	shields: [number, number];
	/** Active buff effects per player */
	buffs: [ActiveBuff[], ActiveBuff[]];
}

export interface ActiveBuff {
	sourceCardId: CardId;
	buffTarget: "damage" | "absorb";
	buffPercent: number;
	affectedTypes: import("./card.js").CardType[];
}
