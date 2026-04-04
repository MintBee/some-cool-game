import { validateBattlePrepInsert, validateDeploy } from "../rules/deploy.js";
import { validateDiscard, validatePick, validateUpgrade } from "../rules/economy.js";
import type { Action } from "../types/action.js";
import type { GameState } from "../types/game.js";
import { Phase } from "../types/game.js";

export interface ValidationResult {
	valid: boolean;
	reason?: string;
}

export function validateAction(state: GameState, action: Action): ValidationResult {
	// Verify the player exists
	const player = state.players.find((p) => p.id === action.playerId);
	if (!player) {
		return { valid: false, reason: "Player not found in game" };
	}

	switch (action.type) {
		case "pickCard":
			return validatePick(state, action.playerId, action.cardId);

		case "deployCard":
			if (state.phase !== Phase.Prep) {
				return { valid: false, reason: "Can only deploy during Prep phase" };
			}
			return validateDeploy(state, action.playerId, action.cardId, action.slot);

		case "insertBattlePrep":
			if (state.phase !== Phase.BattlePrep) {
				return { valid: false, reason: "Can only insert during BattlePrep phase" };
			}
			return validateBattlePrepInsert(state, action.playerId, action.cardId, action.position);

		case "discardCard":
			return validateDiscard(state, action.playerId, action.cardId);

		case "upgradeCard":
			return validateUpgrade(state, action.playerId, action.cardId);

		case "ready":
			if (player.ready) {
				return { valid: false, reason: "Player already marked as ready" };
			}
			return { valid: true };

		default:
			return { valid: false, reason: "Unknown action type" };
	}
}
