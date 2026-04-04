import { getDeployLimits } from "../config.js";
import type { Card, CardId } from "../types/card.js";
import type { GameState, PlayerState, Zones } from "../types/game.js";

export function validateDeploy(
	state: GameState,
	playerId: string,
	cardId: CardId,
	slot: number,
): { valid: boolean; reason?: string } {
	const player = state.players.find((p) => p.id === playerId);
	if (!player) return { valid: false, reason: "Player not found" };

	// Card must be in deck but not already deployed
	const inDeck = player.deck.some((c) => c.id === cardId);
	if (!inDeck) return { valid: false, reason: "Card not in deck" };

	const alreadyDeployed = player.deployed.some((c) => c?.id === cardId);
	if (alreadyDeployed) return { valid: false, reason: "Card already deployed" };

	// Slot must be valid and contiguous (left to right, no gaps)
	const limits = getDeployLimits(state.round);
	const maxSlots = limits.frontier + limits.shadow + limits.battlePrep;
	if (slot < 0 || slot >= maxSlots) {
		return { valid: false, reason: `Slot ${slot} out of range (0-${maxSlots - 1})` };
	}

	// Check contiguous: slot must be the next empty slot
	const firstEmpty = player.deployed.findIndex((c) => c === null);
	if (firstEmpty !== -1 && slot !== firstEmpty) {
		return { valid: false, reason: `Must deploy to next empty slot (${firstEmpty})` };
	}
	if (firstEmpty === -1) {
		return { valid: false, reason: "All slots are filled" };
	}

	return { valid: true };
}

export function validateBattlePrepInsert(
	state: GameState,
	playerId: string,
	cardId: CardId,
	position: number,
): { valid: boolean; reason?: string } {
	if (state.round < 3) {
		return { valid: false, reason: "Battle Prep not available before Round 3" };
	}

	const player = state.players.find((p) => p.id === playerId);
	if (!player) return { valid: false, reason: "Player not found" };

	// Card must be in reserve
	const inReserve = player.reserve.some((c) => c.id === cardId);
	if (!inReserve) return { valid: false, reason: "Card not in reserve" };

	// Position must be valid (0 through deployed.length)
	const deployedCount = player.deployed.filter((c) => c !== null).length;
	if (position < 0 || position > deployedCount) {
		return { valid: false, reason: `Position ${position} out of range (0-${deployedCount})` };
	}

	return { valid: true };
}

export function applyDeploy(player: PlayerState, cardId: CardId, slot: number): PlayerState {
	const card = player.deck.find((c) => c.id === cardId);
	if (!card) return player;

	const deployed = [...player.deployed];
	deployed[slot] = card;

	// Update zones based on slot position
	const zones = computeZones(deployed);

	// Update reserve (deck minus deployed)
	const deployedIds = new Set(deployed.filter((c) => c !== null).map((c) => c?.id));
	const reserve = player.deck.filter((c) => !deployedIds.has(c.id));

	return {
		...player,
		deployed,
		zones,
		reserve,
	};
}

export function applyBattlePrepInsert(
	player: PlayerState,
	cardId: CardId,
	position: number,
): PlayerState {
	const card = player.reserve.find((c) => c.id === cardId);
	if (!card) return player;

	// Insert at position, shifting everything right
	const deployed = [...player.deployed.filter((c) => c !== null)];
	deployed.splice(position, 0, card);

	// Pad to 7 slots
	while (deployed.length < 7) {
		(deployed as (Card | null)[]).push(null);
	}

	// Update zones (the inserted card goes to battlePrep zone)
	const zones = computeZonesWithBattlePrep(deployed as (Card | null)[], position);

	// Update reserve
	const deployedIds = new Set(deployed.filter((c) => c !== null).map((c) => (c as Card).id));
	const reserve = player.deck.filter((c) => !deployedIds.has(c.id));

	return {
		...player,
		deployed: deployed as (Card | null)[],
		zones,
		reserve,
	};
}

function computeZones(deployed: (Card | null)[]): Zones {
	const frontier: number[] = [];
	const shadow: number[] = [];

	for (let i = 0; i < deployed.length; i++) {
		if (deployed[i] === null) continue;
		if (i < 3) frontier.push(i);
		else if (i < 6) shadow.push(i);
	}

	return { frontier, shadow, battlePrep: [] };
}

function computeZonesWithBattlePrep(deployed: (Card | null)[], bpPosition: number): Zones {
	const frontier: number[] = [];
	const shadow: number[] = [];
	const battlePrep: number[] = [];

	for (let i = 0; i < deployed.length; i++) {
		if (deployed[i] === null) continue;
		if (i === bpPosition) {
			battlePrep.push(i);
		} else if (frontier.length < 3 && i < bpPosition) {
			frontier.push(i);
		} else if (shadow.length < 3) {
			shadow.push(i);
		} else {
			frontier.push(i);
		}
	}

	return { frontier, shadow, battlePrep };
}
