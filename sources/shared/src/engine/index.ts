import type { LaneContext } from "../cards/abilities.js";
import { CARD_CATALOG } from "../cards/catalog.js";
import { createCard, upgradeCard } from "../cards/scaling.js";
import { applyBattlePrepInsert, applyDeploy } from "../rules/deploy.js";
import { applyDiscard, applyPick } from "../rules/economy.js";
import { type CarryOverFromLane, resolveLane } from "../rules/lane.js";
import type { Action } from "../types/action.js";
import type { Card } from "../types/card.js";
import { Tier } from "../types/card.js";
import type { ActiveBuff, GameState } from "../types/game.js";
import { advancePhase, populateLanes } from "./PhaseManager.js";
import { validateAction } from "./Validator.js";

export {
	createInitialGameState,
	advancePhase,
	isPhaseComplete,
	populateLanes,
} from "./PhaseManager.js";
export {
	createMatch,
	lockMatch,
	startBattle,
	applyBattleResult,
	getCurrentPairing,
	type BattleResultData,
} from "./MatchManager.js";
export { validateAction } from "./Validator.js";

/**
 * Apply a validated action to the game state.
 * Throws if the action is invalid.
 */
export function applyAction(state: GameState, action: Action): GameState {
	const validation = validateAction(state, action);
	if (!validation.valid) {
		throw new Error(`Invalid action: ${validation.reason}`);
	}

	const playerIdx = state.players.findIndex((p) => p.id === action.playerId);
	const player = state.players[playerIdx];

	switch (action.type) {
		case "pickCard": {
			const def = CARD_CATALOG[action.cardId];
			if (!def) throw new Error(`Card ${action.cardId} not in catalog`);
			const card = createCard(def, Tier.T1);
			const updatedPlayer = applyPick(player, card);
			return updatePlayer(state, playerIdx, updatedPlayer);
		}

		case "deployCard": {
			const updatedPlayer = applyDeploy(player, action.cardId, action.slot);
			return updatePlayer(state, playerIdx, updatedPlayer);
		}

		case "insertBattlePrep": {
			const updatedPlayer = applyBattlePrepInsert(player, action.cardId, action.position);
			return updatePlayer(state, playerIdx, updatedPlayer);
		}

		case "discardCard": {
			const updatedPlayer = applyDiscard(player, action.cardId);
			return updatePlayer(state, playerIdx, updatedPlayer);
		}

		case "upgradeCard": {
			const card = player.deck.find((c) => c.id === action.cardId);
			if (!card) throw new Error("Card not found");
			const upgraded = upgradeCard(card, CARD_CATALOG);
			const updatedDeck = player.deck.map((c) => (c.id === action.cardId ? upgraded : c));
			return updatePlayer(state, playerIdx, { ...player, deck: updatedDeck });
		}

		case "ready": {
			return updatePlayer(state, playerIdx, { ...player, ready: true });
		}
	}
}

function updatePlayer(
	state: GameState,
	playerIdx: number,
	updatedPlayer: GameState["players"][number],
): GameState {
	const players = [...state.players] as [typeof updatedPlayer, typeof updatedPlayer];
	players[playerIdx] = updatedPlayer;
	return { ...state, players };
}

/**
 * Resolve all lanes in a battle sequentially.
 * Handles carry-over effects (Aegis shield, active buffs).
 * Returns the final state with all lanes resolved and HP updated.
 */
export function resolveBattle(state: GameState): GameState {
	const current = populateLanes(state);
	let hpA = current.players[0].hp;
	let hpB = current.players[1].hp;
	let carryShieldA = 0;
	let carryShieldB = 0;
	const activeBuffsA: ActiveBuff[] = [];
	const activeBuffsB: ActiveBuff[] = [];

	const resolvedLanes = current.lanes.map((lane, i) => {
		const cardA = findCardById(current.players[0], lane.cardA);
		const cardB = findCardById(current.players[1], lane.cardB);

		// If either lane is empty, skip
		if (!cardA || !cardB) {
			return { ...lane, resolved: true, result: null };
		}

		// Build adjacent cards for formation buff checks
		const adjacentA = getAdjacentCards(current.players[0], i);
		const adjacentB = getAdjacentCards(current.players[1], i);

		const ctx: LaneContext = {
			laneIndex: i,
			hpA,
			hpB,
			opponentIsShield: false, // will be set per-card in resolveLane
			wasInShadow: isInShadowZone(current.players[0], cardA),
			carryOverShields: [carryShieldA, carryShieldB],
			activeBuffs: [[...activeBuffsA], [...activeBuffsB]],
			adjacentAlliedCards: adjacentA, // A's adjacent for A's buff checks
		};

		// We need separate contexts — adjacentAlliedCards differs per player
		// The lane resolver handles this internally via playerIndex

		const result = resolveLane({ cardA, cardB, context: ctx });

		// Extract carry-over data
		const carryOver = (result as unknown as { _carryOver: CarryOverFromLane })._carryOver;

		// Update carry-over shields
		carryShieldA = carryOver.shieldA;
		carryShieldB = carryOver.shieldB;

		// Register new buffs
		if (carryOver.buffA) activeBuffsA.push(carryOver.buffA);
		if (carryOver.buffB) activeBuffsB.push(carryOver.buffB);

		// Apply HP changes
		hpA = Math.max(0, hpA + result.hpDeltaA);
		hpB = Math.max(0, hpB + result.hpDeltaB);

		return { ...lane, resolved: true, cardA: cardA.id, cardB: cardB.id, result };
	});

	return {
		...current,
		lanes: resolvedLanes,
		players: [
			{ ...current.players[0], hp: hpA },
			{ ...current.players[1], hp: hpB },
		],
		carryOver: {
			shields: [carryShieldA, carryShieldB],
			buffs: [activeBuffsA, activeBuffsB],
		},
	};
}

function findCardById(player: GameState["players"][number], cardId: string | null): Card | null {
	if (!cardId) return null;
	return player.deployed.find((c) => c?.id === cardId) ?? null;
}

function getAdjacentCards(
	player: GameState["players"][number],
	laneIndex: number,
): (Card | null)[] {
	const cards: (Card | null)[] = [];
	if (laneIndex > 0) cards.push(player.deployed[laneIndex - 1]);
	if (laneIndex < player.deployed.length - 1) cards.push(player.deployed[laneIndex + 1]);
	return cards;
}

function isInShadowZone(player: GameState["players"][number], card: Card): boolean {
	const idx = player.deployed.findIndex((c) => c?.id === card.id);
	return player.zones.shadow.includes(idx);
}
