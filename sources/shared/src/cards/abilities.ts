import type { Card, CardDefinition } from "../types/card.js";
import { CardType } from "../types/card.js";
import type { ActiveBuff } from "../types/game.js";
import { CARD_CATALOG } from "./catalog.js";

/** Context available during lane resolution */
export interface LaneContext {
	laneIndex: number;
	/** Current HP of player A (the card's owner for cardA) */
	hpA: number;
	/** Current HP of player B */
	hpB: number;
	/** Whether the opponent card in this lane is a Shield */
	opponentIsShield: boolean;
	/** Whether this card was deployed in the Shadow zone */
	wasInShadow: boolean;
	/** Active carry-over shields: [playerA, playerB] */
	carryOverShields: [number, number];
	/** Active buffs per player: [playerA buffs, playerB buffs] */
	activeBuffs: [ActiveBuff[], ActiveBuff[]];
	/** Cards deployed in adjacent lanes (for Formation buff checks) */
	adjacentAlliedCards: (Card | null)[];
}

export interface AbilityResult {
	/** Damage dealt to opponent HP */
	damageToOpponent: number;
	/** Damage dealt to self (e.g., reflect) */
	damageToSelf: number;
	/** Healing to self */
	healSelf: number;
	/** Shield absorption this card provides */
	shieldAbsorb: number;
	/** Whether shield carries over to next lane */
	shieldCarryOver: boolean;
	/** Weaken percentage applied to opponent */
	weakenPercent: number;
	/** Chip damage from disrupt */
	chipDamage: number;
	/** Buff to register for subsequent lanes */
	buff: ActiveBuff | null;
	/** Whether this card's buff/nuke condition was met */
	conditionMet: boolean;
	/** Reflect damage (dealt back to attacker) */
	reflectDamage: number;
	/** Extra description of what happened */
	description: string;
}

function emptyResult(): AbilityResult {
	return {
		damageToOpponent: 0,
		damageToSelf: 0,
		healSelf: 0,
		shieldAbsorb: 0,
		shieldCarryOver: false,
		weakenPercent: 0,
		chipDamage: 0,
		buff: null,
		conditionMet: true,
		reflectDamage: 0,
		description: "",
	};
}

function getDefinition(card: Card): CardDefinition {
	return CARD_CATALOG[card.definitionId];
}

/** Apply active buffs to a damage or absorb value */
export function applyBuffs(
	value: number,
	card: Card,
	buffs: ActiveBuff[],
	statType: "damage" | "absorb",
): number {
	let result = value;
	for (const buff of buffs) {
		if (buff.buffTarget !== statType) continue;
		if (!buff.affectedTypes.includes(card.type)) continue;
		result += Math.floor((value * buff.buffPercent) / 100);
	}
	return result;
}

export function resolveDisrupt(card: Card, opponent: Card, ctx: LaneContext): AbilityResult {
	const result = emptyResult();
	const def = getDefinition(card);
	const stats = def.stats;
	if (stats.type !== CardType.Disrupt) return result;

	let weaken = card.weakenPercent;

	// Hex bonus vs Buff/Nuke
	if (stats.bonusWeakenPercent && stats.bonusTargets?.includes(opponent.type)) {
		const tierKey = `t${card.tier}` as "t1" | "t2" | "t3";
		weaken += stats.bonusWeakenPercent[tierKey];
	}

	result.weakenPercent = weaken;
	result.chipDamage = card.chipDamage;
	result.description = `${card.name} weakens ${opponent.name} by ${weaken}%`;
	return result;
}

export function resolveShield(
	card: Card,
	_opponent: Card,
	ctx: LaneContext,
	playerIndex: 0 | 1,
): AbilityResult {
	const result = emptyResult();
	const def = getDefinition(card);
	const stats = def.stats;
	if (stats.type !== CardType.Shield) return result;

	let absorb = card.absorb;
	// Apply carry-over from previous Aegis
	absorb += ctx.carryOverShields[playerIndex];

	// Apply buffs to absorb
	absorb = applyBuffs(absorb, card, ctx.activeBuffs[playerIndex], "absorb");

	result.shieldAbsorb = absorb;
	result.shieldCarryOver = stats.carryOver === true;

	if (stats.reflectFraction) {
		result.reflectDamage = stats.reflectFraction;
		result.description = `${card.name} absorbs ${absorb} and reflects 30%`;
	} else {
		result.description = `${card.name} absorbs up to ${absorb} damage`;
	}

	return result;
}

export function resolveBuff(
	card: Card,
	opponent: Card,
	ctx: LaneContext,
	playerIndex: 0 | 1,
): AbilityResult {
	const result = emptyResult();
	const def = getDefinition(card);
	const stats = def.stats;
	if (stats.type !== CardType.Buff) return result;

	// Check condition
	const condition = stats.condition;
	if (condition.kind === "desperation") {
		const myHp = playerIndex === 0 ? ctx.hpA : ctx.hpB;
		if (myHp > condition.hpThreshold) {
			result.conditionMet = false;
			result.description = `${card.name} condition not met (HP ${myHp} > ${condition.hpThreshold})`;
			return result;
		}
	} else if (condition.kind === "formation") {
		const hasAdjacentType = ctx.adjacentAlliedCards.some(
			(c) => c !== null && c.type === condition.adjacentType,
		);
		if (!hasAdjacentType) {
			result.conditionMet = false;
			result.description = `${card.name} condition not met (no adjacent ${condition.adjacentType})`;
			return result;
		}
	}

	result.buff = {
		sourceCardId: card.id,
		buffTarget: stats.buffTarget,
		buffPercent: card.buffValue,
		affectedTypes: stats.affectedTypes,
	};
	result.conditionMet = true;
	result.description = `${card.name} buffs subsequent ${stats.affectedTypes.join("/")} by ${card.buffValue}%`;
	return result;
}

export function resolveStrike(
	card: Card,
	opponent: Card,
	ctx: LaneContext,
	playerIndex: 0 | 1,
): AbilityResult {
	const result = emptyResult();
	const def = getDefinition(card);
	const stats = def.stats;
	if (stats.type !== CardType.Strike) return result;

	let damage = card.damage;

	// Apply buffs to damage
	damage = applyBuffs(damage, card, ctx.activeBuffs[playerIndex], "damage");

	const effect = stats.effect;

	if (effect?.kind === "riposte" && opponent.type === CardType.Disrupt) {
		const tierKey = `t${card.tier}` as "t1" | "t2" | "t3";
		damage += effect.bonusDamage[tierKey];
		result.description = `${card.name} ripostes for ${damage} total damage`;
	} else if (effect?.kind === "executioner") {
		const enemyHp = playerIndex === 0 ? ctx.hpB : ctx.hpA;
		if (enemyHp <= effect.hpThreshold) {
			const tierKey = `t${card.tier}` as "t1" | "t2" | "t3";
			damage += effect.bonusDamage[tierKey];
			result.description = `${card.name} executes for ${damage} total damage`;
		} else {
			result.description = `${card.name} deals ${damage} damage`;
		}
	} else if (effect?.kind === "twinStrike") {
		// Twin Strike: two hits, each buffed independently
		const hit1 = applyBuffs(card.damage, card, ctx.activeBuffs[playerIndex], "damage");
		const hit2 = applyBuffs(card.damage, card, ctx.activeBuffs[playerIndex], "damage");
		damage = hit1 + hit2;
		result.description = `${card.name} hits twice for ${hit1}+${hit2}=${damage} damage`;
	} else if (effect?.kind === "drain") {
		const tierKey = `t${card.tier}` as "t1" | "t2" | "t3";
		result.healSelf = effect.healPerTier[tierKey];
		result.description = `${card.name} deals ${damage} and heals ${result.healSelf}`;
	} else {
		result.description = `${card.name} deals ${damage} damage`;
	}

	result.damageToOpponent = damage;
	return result;
}

export function resolveNuke(
	card: Card,
	opponent: Card,
	ctx: LaneContext,
	playerIndex: 0 | 1,
): AbilityResult {
	const result = emptyResult();
	const def = getDefinition(card);
	const stats = def.stats;
	if (stats.type !== CardType.Nuke) return result;

	// Check nuke condition
	const condition = stats.condition;
	let conditionMet = false;

	switch (condition.kind) {
		case "noShield":
			conditionMet = !ctx.opponentIsShield;
			break;
		case "lowHp": {
			const enemyHp = playerIndex === 0 ? ctx.hpB : ctx.hpA;
			conditionMet = enemyHp <= condition.hpThreshold;
			break;
		}
		case "fromShadow":
			conditionMet = ctx.wasInShadow;
			break;
		case "hpDisadvantage": {
			const myHp = playerIndex === 0 ? ctx.hpA : ctx.hpB;
			const enemyHp = playerIndex === 0 ? ctx.hpB : ctx.hpA;
			conditionMet = myHp < enemyHp;
			break;
		}
	}

	result.conditionMet = conditionMet;

	if (!conditionMet) {
		result.damageToOpponent = 0;
		result.description = `${card.name} condition not met — 0 damage`;
		return result;
	}

	let damage = card.damage;
	damage = applyBuffs(damage, card, ctx.activeBuffs[playerIndex], "damage");
	result.damageToOpponent = damage;
	result.description = `${card.name} condition met — ${damage} damage`;
	return result;
}
