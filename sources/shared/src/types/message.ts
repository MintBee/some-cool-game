import type { Card, CardId } from "./card.js";
import type { GameState, LaneResult } from "./game.js";

export type GameMessage =
	| DraftChoicesMessage
	| PickCardMessage
	| DeployCardMessage
	| InsertBattlePrepMessage
	| DiscardCardMessage
	| UpgradeCardMessage
	| ReadyMessage
	| StateSyncMessage
	| OpponentPartialMessage
	| LaneRevealMessage
	| BattleResultMessage
	| MatchStartedMessage
	| PhaseChangeMessage;

export interface DraftChoicesMessage {
	type: "draftChoices";
	choices: Card[];
}

export interface PickCardMessage {
	type: "pickCard";
	cardId: CardId;
}

export interface DeployCardMessage {
	type: "deployCard";
	cardId: CardId;
	slot: number;
}

export interface InsertBattlePrepMessage {
	type: "insertBattlePrep";
	cardId: CardId;
	position: number;
}

export interface DiscardCardMessage {
	type: "discardCard";
	cardId: CardId;
}

export interface UpgradeCardMessage {
	type: "upgradeCard";
	cardId: CardId;
}

export interface ReadyMessage {
	type: "ready";
}

export interface StateSyncMessage {
	type: "stateSync";
	state: GameState;
}

export interface OpponentPartialMessage {
	type: "opponentPartial";
	/** Visibility-filtered opponent board */
	deployed: OpponentCardView[];
	hp: number;
	trophies: number;
}

export interface OpponentCardView {
	slot: number;
	zone: "frontier" | "shadow" | "battlePrep";
	/** Full card for frontier, type-only for shadow, null for battlePrep */
	card: Card | { type: string } | null;
}

export interface LaneRevealMessage {
	type: "laneReveal";
	lane: number;
	cardA: Card;
	cardB: Card;
	result: LaneResult;
}

export interface BattleResultMessage {
	type: "battleResult";
	winner: string | null;
	hpA: number;
	hpB: number;
	trophies: [number, number];
}

export interface MatchStartedMessage {
	type: "matchStarted";
	matchId: string;
	players: string[];
	hostId: string;
}

export interface PhaseChangeMessage {
	type: "phaseChange";
	phase: string;
	round: number;
}
