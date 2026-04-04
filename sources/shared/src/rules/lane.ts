import {
	type AbilityResult,
	type LaneContext,
	resolveBuff,
	resolveDisrupt,
	resolveNuke,
	resolveShield,
	resolveStrike,
} from "../cards/abilities.js";
import { CARD_CATALOG } from "../cards/catalog.js";
import type { Card } from "../types/card.js";
import { CardType, PRIORITY } from "../types/card.js";
import type { StrikeStats } from "../types/card.js";
import type { ActiveBuff, LaneResult, ResolvedEffect } from "../types/game.js";

interface LaneInput {
	cardA: Card;
	cardB: Card;
	context: LaneContext;
}

function resolveCardAbility(
	card: Card,
	opponent: Card,
	ctx: LaneContext,
	playerIndex: 0 | 1,
): AbilityResult {
	switch (card.type) {
		case CardType.Disrupt:
			return resolveDisrupt(card, opponent, ctx);
		case CardType.Shield:
			return resolveShield(card, opponent, ctx, playerIndex);
		case CardType.Buff:
			return resolveBuff(card, opponent, ctx, playerIndex);
		case CardType.Strike:
			return resolveStrike(card, opponent, ctx, playerIndex);
		case CardType.Nuke:
			return resolveNuke(card, opponent, ctx, playerIndex);
	}
}

/**
 * Resolve a single lane: both cards activate in priority order.
 * Lower priority activates first. Same priority = simultaneous.
 */
export function resolveLane(input: LaneInput): LaneResult {
	const { cardA, cardB, context } = input;
	const effects: ResolvedEffect[] = [];
	let hpDeltaA = 0;
	let hpDeltaB = 0;

	const prioA = PRIORITY[cardA.type];
	const prioB = PRIORITY[cardB.type];

	// Update context with opponent shield info
	const ctxA: LaneContext = {
		...context,
		opponentIsShield: cardB.type === CardType.Shield,
		wasInShadow: false, // caller should set this
	};
	const ctxB: LaneContext = {
		...context,
		opponentIsShield: cardA.type === CardType.Shield,
		wasInShadow: false,
	};

	let resultA: AbilityResult;
	let resultB: AbilityResult;

	if (prioA < prioB) {
		// A activates first
		resultA = resolveCardAbility(cardA, cardB, ctxA, 0);
		// Apply A's weaken to B before B activates
		resultB = resolveCardAbilityWithWeaken(cardB, cardA, ctxB, 1, resultA.weakenPercent);
	} else if (prioB < prioA) {
		// B activates first
		resultB = resolveCardAbility(cardB, cardA, ctxB, 1);
		// Apply B's weaken to A before A activates
		resultA = resolveCardAbilityWithWeaken(cardA, cardB, ctxA, 0, resultB.weakenPercent);
	} else {
		// Simultaneous — no weaken applied to each other's activation
		resultA = resolveCardAbility(cardA, cardB, ctxA, 0);
		resultB = resolveCardAbility(cardB, cardA, ctxB, 1);
	}

	// --- Apply damage with shield absorption ---

	// Damage from A to B
	const damageAToB = resultA.damageToOpponent + resultA.chipDamage;
	// Handle Pierce: reduce shield effectiveness
	let shieldB = resultB.shieldAbsorb;
	if (cardA.type === CardType.Strike) {
		const def = getStrikeEffect(cardA);
		if (def?.kind === "pierce") {
			shieldB = Math.floor(shieldB * (1 - def.shieldIgnorePercent / 100));
		}
	}
	// Apply shield absorption
	const absorbedByB = Math.min(damageAToB, shieldB);
	const throughDamageToB = damageAToB - absorbedByB;
	hpDeltaB = -throughDamageToB || 0;

	// Reflect damage back to A
	if (resultB.reflectDamage > 0 && damageAToB > 0) {
		const reflected = Math.floor(damageAToB * resultB.reflectDamage);
		hpDeltaA -= reflected;
		effects.push({
			type: "reflect",
			source: cardB.id,
			target: cardA.id,
			value: reflected,
			description: `${cardB.name} reflects ${reflected} damage`,
		});
	}

	// Shield carry-over for B (Aegis)
	const leftoverShieldB = shieldB - absorbedByB;

	// Damage from B to A
	const damageBToA = resultB.damageToOpponent + resultB.chipDamage;
	let shieldA = resultA.shieldAbsorb;
	if (cardB.type === CardType.Strike) {
		const def = getStrikeEffect(cardB);
		if (def?.kind === "pierce") {
			shieldA = Math.floor(shieldA * (1 - def.shieldIgnorePercent / 100));
		}
	}
	const absorbedByA = Math.min(damageBToA, shieldA);
	const throughDamageToA = damageBToA - absorbedByA;
	hpDeltaA = hpDeltaA - throughDamageToA || 0;

	// Reflect damage back to B
	if (resultA.reflectDamage > 0 && damageBToA > 0) {
		const reflected = Math.floor(damageBToA * resultA.reflectDamage);
		hpDeltaB -= reflected;
		effects.push({
			type: "reflect",
			source: cardA.id,
			target: cardB.id,
			value: reflected,
			description: `${cardA.name} reflects ${reflected} damage`,
		});
	}

	// Shield carry-over for A (Aegis)
	const leftoverShieldA = shieldA - absorbedByA;

	// Healing
	if (resultA.healSelf > 0) hpDeltaA += resultA.healSelf;
	if (resultB.healSelf > 0) hpDeltaB += resultB.healSelf;

	// Buffs broken by damage (fragile)
	if (resultA.buff && throughDamageToA > 0) {
		resultA.buff = null;
		effects.push({
			type: "buffBroken",
			source: cardB.id,
			target: cardA.id,
			value: 0,
			description: `${cardA.name}'s buff is broken by damage`,
		});
	}
	if (resultB.buff && throughDamageToB > 0) {
		resultB.buff = null;
		effects.push({
			type: "buffBroken",
			source: cardA.id,
			target: cardB.id,
			value: 0,
			description: `${cardB.name}'s buff is broken by damage`,
		});
	}

	// Log effects
	if (resultA.description) {
		effects.push({
			type: cardA.type,
			source: cardA.id,
			target: cardB.id,
			value: resultA.damageToOpponent,
			description: resultA.description,
		});
	}
	if (resultB.description) {
		effects.push({
			type: cardB.type,
			source: cardB.id,
			target: cardA.id,
			value: resultB.damageToOpponent,
			description: resultB.description,
		});
	}

	// Determine winner
	let winner: "A" | "B" | "draw" = "draw";
	if (hpDeltaB < hpDeltaA) winner = "A";
	else if (hpDeltaA < hpDeltaB) winner = "B";

	return {
		winner,
		hpDeltaA,
		hpDeltaB,
		effects,
		// Carry-over data (consumed by the battle resolver)
		_carryOver: {
			shieldA: resultA.shieldCarryOver ? Math.max(0, leftoverShieldA) : 0,
			shieldB: resultB.shieldCarryOver ? Math.max(0, leftoverShieldB) : 0,
			buffA: resultA.buff,
			buffB: resultB.buff,
		},
	} as LaneResult & { _carryOver: CarryOverFromLane };
}

export interface CarryOverFromLane {
	shieldA: number;
	shieldB: number;
	buffA: ActiveBuff | null;
	buffB: ActiveBuff | null;
}

function resolveCardAbilityWithWeaken(
	card: Card,
	opponent: Card,
	ctx: LaneContext,
	playerIndex: 0 | 1,
	weakenPercent: number,
): AbilityResult {
	if (weakenPercent <= 0) {
		return resolveCardAbility(card, opponent, ctx, playerIndex);
	}

	// Create a weakened copy of the card
	const weakened: Card = {
		...card,
		damage: Math.max(0, Math.floor(card.damage * (1 - weakenPercent / 100))),
		absorb: Math.max(0, Math.floor(card.absorb * (1 - weakenPercent / 100))),
		weakenPercent: Math.max(0, Math.floor(card.weakenPercent * (1 - weakenPercent / 100))),
		buffValue: Math.max(0, Math.floor(card.buffValue * (1 - weakenPercent / 100))),
	};

	return resolveCardAbility(weakened, opponent, ctx, playerIndex);
}

function getStrikeEffect(card: Card) {
	const def = CARD_CATALOG[card.definitionId];
	if (!def || def.stats.type !== CardType.Strike) return null;
	return (def.stats as StrikeStats).effect ?? null;
}
