import type { CardId } from "./card.js";

export type Action =
	| PickCardAction
	| DeployCardAction
	| InsertBattlePrepAction
	| DiscardCardAction
	| UpgradeCardAction
	| ReadyAction;

export interface PickCardAction {
	type: "pickCard";
	playerId: string;
	cardId: CardId;
}

export interface DeployCardAction {
	type: "deployCard";
	playerId: string;
	cardId: CardId;
	slot: number;
}

export interface InsertBattlePrepAction {
	type: "insertBattlePrep";
	playerId: string;
	cardId: CardId;
	position: number;
}

export interface DiscardCardAction {
	type: "discardCard";
	playerId: string;
	cardId: CardId;
}

export interface UpgradeCardAction {
	type: "upgradeCard";
	playerId: string;
	cardId: CardId;
}

export interface ReadyAction {
	type: "ready";
	playerId: string;
}
