export enum CardType {
	Disrupt = "Disrupt",
	Shield = "Shield",
	Buff = "Buff",
	Strike = "Strike",
	Nuke = "Nuke",
}

export enum Tier {
	T1 = 1,
	T2 = 2,
	T3 = 3,
}

/** Priority order: lower number activates first */
export const PRIORITY: Record<CardType, number> = {
	[CardType.Disrupt]: 0,
	[CardType.Shield]: 1,
	[CardType.Buff]: 2,
	[CardType.Strike]: 3,
	[CardType.Nuke]: 4,
};

export type CardId = string;

export type BuffSubtype = "desperation" | "formation";

export interface TierStats {
	t1: number;
	t2: number;
	t3: number;
}

export interface CardDefinition {
	id: CardId;
	name: string;
	type: CardType;
	ability: string;
	/** Type-specific stats per tier */
	stats: CardStats;
}

export type CardStats = DisruptStats | ShieldStats | BuffStats | StrikeStats | NukeStats;

export interface DisruptStats {
	type: CardType.Disrupt;
	weakenPercent: TierStats;
	chipDamage: TierStats;
	/** Extra weaken % vs specific types (e.g., Hex vs Buff/Nuke) */
	bonusWeakenPercent?: TierStats;
	bonusTargets?: CardType[];
}

export interface ShieldStats {
	type: CardType.Shield;
	absorb: TierStats;
	/** Fraction of damage reflected back (e.g., 0.3 for Reflect) */
	reflectFraction?: number;
	/** Whether leftover shield carries to next lane (Aegis) */
	carryOver?: boolean;
	/** Whether this shield pulls adjacent enemy damage (Taunt) */
	taunt?: boolean;
}

export interface BuffStats {
	type: CardType.Buff;
	subtype: BuffSubtype;
	buffValue: TierStats;
	/** What the buff modifies */
	buffTarget: "damage" | "absorb";
	/** Which allied card types benefit from this buff */
	affectedTypes: CardType[];
	/** Desperation: HP threshold; Formation: required adjacent card type */
	condition: DesperationCondition | FormationCondition;
}

export interface DesperationCondition {
	kind: "desperation";
	hpThreshold: number;
}

export interface FormationCondition {
	kind: "formation";
	adjacentType: CardType;
}

export interface StrikeStats {
	type: CardType.Strike;
	damage: TierStats;
	/** Secondary effect */
	effect?: StrikeEffect;
}

export type StrikeEffect =
	| { kind: "pierce"; shieldIgnorePercent: number }
	| { kind: "drain"; healPerTier: TierStats }
	| { kind: "twinStrike" }
	| { kind: "riposte"; bonusDamage: TierStats }
	| { kind: "executioner"; bonusDamage: TierStats; hpThreshold: number };

export interface NukeStats {
	type: CardType.Nuke;
	damage: TierStats;
	condition: NukeCondition;
}

export type NukeCondition =
	| { kind: "noShield" }
	| { kind: "lowHp"; hpThreshold: number }
	| { kind: "fromShadow" }
	| { kind: "hpDisadvantage" };

/** A card instance in play (has a resolved tier) */
export interface Card {
	id: CardId;
	name: string;
	type: CardType;
	tier: Tier;
	ability: string;
	/** Resolved numeric stats for the current tier */
	damage: number;
	absorb: number;
	weakenPercent: number;
	chipDamage: number;
	buffValue: number;
	/** Reference to the full definition for ability logic */
	definitionId: CardId;
}
