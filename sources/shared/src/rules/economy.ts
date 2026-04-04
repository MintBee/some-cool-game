import { CATALOG_IDS } from "../cards/catalog.js";
import { BUILDING_PICKS, DRAFT_CHOICES } from "../config.js";
import { pickRandom } from "../rng.js";
import type { Card, CardId } from "../types/card.js";
import { Tier } from "../types/card.js";
import type { GameState, PlayerState } from "../types/game.js";
import { Phase } from "../types/game.js";

export type EconomyPhase = "building" | "replacement" | "reinforcement";

export function getEconomyPhase(round: number): EconomyPhase {
	if (round <= 3) return "building";
	if (round <= 9) return "replacement";
	return "reinforcement";
}

export function getDraftPickCount(round: number): number {
	return BUILDING_PICKS[round] ?? 0;
}

/** Generate draft choices: arrays of DRAFT_CHOICES card IDs for each pick */
export function generateDraftChoices(count: number, rng: () => number): CardId[][] {
	const choices: CardId[][] = [];
	for (let i = 0; i < count; i++) {
		choices.push(pickRandom(CATALOG_IDS, DRAFT_CHOICES, rng));
	}
	return choices;
}

export function validatePick(
	state: GameState,
	playerId: string,
	cardId: CardId,
): { valid: boolean; reason?: string } {
	if (state.phase !== Phase.Building && state.phase !== Phase.Prep) {
		// Replacement phase pick happens after discard during Prep
		const econ = getEconomyPhase(state.round);
		if (econ !== "replacement") {
			return { valid: false, reason: "Not in a picking phase" };
		}
	}
	return { valid: true };
}

export function validateDiscard(
	state: GameState,
	playerId: string,
	cardId: CardId,
): { valid: boolean; reason?: string } {
	const econ = getEconomyPhase(state.round);
	if (econ !== "replacement") {
		return { valid: false, reason: "Discard only available in replacement phase (R4-R9)" };
	}

	const player = state.players.find((p) => p.id === playerId);
	if (!player) return { valid: false, reason: "Player not found" };

	const hasCard = player.deck.some((c) => c.id === cardId);
	if (!hasCard) return { valid: false, reason: "Card not in deck" };

	return { valid: true };
}

export function validateUpgrade(
	state: GameState,
	playerId: string,
	cardId: CardId,
): { valid: boolean; reason?: string } {
	const econ = getEconomyPhase(state.round);
	if (econ !== "reinforcement") {
		return { valid: false, reason: "Upgrade only available in reinforcement phase (R10+)" };
	}

	const player = state.players.find((p) => p.id === playerId);
	if (!player) return { valid: false, reason: "Player not found" };

	const card = player.deck.find((c) => c.id === cardId);
	if (!card) return { valid: false, reason: "Card not in deck" };

	if (card.tier >= Tier.T3) {
		return { valid: false, reason: "Card is already max tier (T3)" };
	}

	return { valid: true };
}

export function applyPick(player: PlayerState, card: Card): PlayerState {
	const newDeck = [...player.deck, card];
	// Reserve = deck minus deployed cards
	const deployedIds = new Set(player.deployed.filter((c) => c !== null).map((c) => c!.id));
	const newReserve = newDeck.filter((c) => !deployedIds.has(c.id));
	return {
		...player,
		deck: newDeck,
		reserve: newReserve,
	};
}

export function applyDiscard(player: PlayerState, cardId: CardId): PlayerState {
	return {
		...player,
		deck: player.deck.filter((c) => c.id !== cardId),
	};
}
