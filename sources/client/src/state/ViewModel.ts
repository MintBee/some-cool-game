import type { Card, CardType, GameState, LaneResult, LaneState } from "@game/shared";
import { type VisibleCard, type VisibleGameState, filterStateForPlayer } from "@game/shared";

export interface CardView {
	id: string;
	name: string;
	type: CardType;
	tier: number;
	damage: number;
	absorb: number;
	ability: string;
}

export interface OpponentCardView {
	visibility: "full" | "typeOnly" | "hidden";
	type?: string;
	card?: CardView;
}

export interface LaneView {
	index: number;
	resolved: boolean;
	myCard: CardView | null;
	opponentCard: OpponentCardView | null;
	result: LaneResult | null;
}

export interface BoardViewModel {
	lanes: LaneView[];
	myHp: number;
	opponentHp: number;
	myTrophies: number;
	opponentTrophies: number;
	phase: string;
	round: number;
	myReserve: CardView[];
	myDeck: CardView[];
	timerEnd: number;
}

function toCardView(card: Card): CardView {
	return {
		id: card.id,
		name: card.name,
		type: card.type,
		tier: card.tier,
		damage: card.damage,
		absorb: card.absorb,
		ability: card.ability,
	};
}

function toOpponentCardView(vc: VisibleCard): OpponentCardView {
	switch (vc.visibility) {
		case "full":
			return { visibility: "full", card: toCardView(vc.card), type: vc.card.type };
		case "typeOnly":
			return { visibility: "typeOnly", type: vc.type };
		case "hidden":
			return { visibility: "hidden" };
	}
}

export function deriveViewModel(state: GameState, playerId: string): BoardViewModel {
	const visible = filterStateForPlayer(state, playerId);
	return deriveViewModelFromVisible(visible);
}

/** Derive ViewModel from pre-filtered VisibleGameState (used by non-host peers) */
export function deriveViewModelFromVisible(visible: VisibleGameState): BoardViewModel {
	const self = visible.self;
	const opp = visible.opponent;

	const lanes: LaneView[] = visible.lanes.map((lane: LaneState, i: number) => {
		const myCard = self.deployed[i] ? toCardView(self.deployed[i] as Card) : null;
		const oppVisible = opp.deployed[i];
		const opponentCard = oppVisible ? toOpponentCardView(oppVisible as VisibleCard) : null;

		return {
			index: i,
			resolved: lane.resolved,
			myCard,
			opponentCard,
			result: lane.result,
		};
	});

	return {
		lanes,
		myHp: self.hp,
		opponentHp: opp.hp,
		myTrophies: self.trophies,
		opponentTrophies: opp.trophies,
		phase: visible.phase,
		round: visible.round,
		myReserve: self.reserve.map(toCardView),
		myDeck: self.deck.map(toCardView),
		timerEnd: visible.timers.phaseEnd,
	};
}
