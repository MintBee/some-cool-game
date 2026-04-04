import { type CardDefinition, CardType } from "../types/card.js";

/**
 * Complete 22-card catalog.
 * Stats reference: wiki/card_design.md
 */
export const CARD_CATALOG: Record<string, CardDefinition> = {
	// ═══════════════════════════════════════════════════
	// DISRUPT (P0) — 4 cards
	// ═══════════════════════════════════════════════════
	sabotage: {
		id: "sabotage",
		name: "Sabotage",
		type: CardType.Disrupt,
		ability: "Reduce enemy card's primary effect",
		stats: {
			type: CardType.Disrupt,
			weakenPercent: { t1: 30, t2: 40, t3: 50 },
			chipDamage: { t1: 0, t2: 1, t3: 2 },
		},
	},
	expose: {
		id: "expose",
		name: "Expose",
		type: CardType.Disrupt,
		ability: "Weaken + reveal next Shadow card",
		stats: {
			type: CardType.Disrupt,
			weakenPercent: { t1: 20, t2: 30, t3: 40 },
			chipDamage: { t1: 0, t2: 0, t3: 1 },
		},
	},
	siphon: {
		id: "siphon",
		name: "Siphon",
		type: CardType.Disrupt,
		ability: "Weaken + gain small shield",
		stats: {
			type: CardType.Disrupt,
			weakenPercent: { t1: 25, t2: 35, t3: 45 },
			chipDamage: { t1: 0, t2: 0, t3: 1 },
		},
	},
	hex: {
		id: "hex",
		name: "Hex",
		type: CardType.Disrupt,
		ability: "Bonus weaken vs Buff or Nuke",
		stats: {
			type: CardType.Disrupt,
			weakenPercent: { t1: 20, t2: 30, t3: 40 },
			chipDamage: { t1: 0, t2: 1, t3: 2 },
			bonusWeakenPercent: { t1: 20, t2: 25, t3: 30 },
			bonusTargets: [CardType.Buff, CardType.Nuke],
		},
	},

	// ═══════════════════════════════════════════════════
	// SHIELD (P1) — 4 cards
	// ═══════════════════════════════════════════════════
	barrier: {
		id: "barrier",
		name: "Barrier",
		type: CardType.Shield,
		ability: "Pure absorption",
		stats: {
			type: CardType.Shield,
			absorb: { t1: 6, t2: 8, t3: 11 },
		},
	},
	reflect: {
		id: "reflect",
		name: "Reflect",
		type: CardType.Shield,
		ability: "Absorb + reflect 30% back as damage",
		stats: {
			type: CardType.Shield,
			absorb: { t1: 4, t2: 6, t3: 8 },
			reflectFraction: 0.3,
		},
	},
	aegis: {
		id: "aegis",
		name: "Aegis",
		type: CardType.Shield,
		ability: "If overkill, carry leftover shield to next lane",
		stats: {
			type: CardType.Shield,
			absorb: { t1: 5, t2: 7, t3: 10 },
			carryOver: true,
		},
	},
	taunt: {
		id: "taunt",
		name: "Taunt",
		type: CardType.Shield,
		ability: "Absorb + forces adjacent enemy lane to also target you",
		stats: {
			type: CardType.Shield,
			absorb: { t1: 4, t2: 5, t3: 7 },
			taunt: true,
		},
	},

	// ═══════════════════════════════════════════════════
	// BUFF (P2) — 4 cards
	// ═══════════════════════════════════════════════════
	rally: {
		id: "rally",
		name: "Rally",
		type: CardType.Buff,
		ability: "Boost damage of subsequent Strike/Nuke cards (HP ≤ 15)",
		stats: {
			type: CardType.Buff,
			subtype: "desperation",
			buffValue: { t1: 25, t2: 35, t3: 50 },
			buffTarget: "damage",
			affectedTypes: [CardType.Strike, CardType.Nuke],
			condition: { kind: "desperation", hpThreshold: 15 },
		},
	},
	lastStand: {
		id: "lastStand",
		name: "Last Stand",
		type: CardType.Buff,
		ability: "Grant shield to subsequent allied cards (HP ≤ 10)",
		stats: {
			type: CardType.Buff,
			subtype: "desperation",
			buffValue: { t1: 3, t2: 4, t3: 6 },
			buffTarget: "absorb",
			affectedTypes: [
				CardType.Disrupt,
				CardType.Shield,
				CardType.Buff,
				CardType.Strike,
				CardType.Nuke,
			],
			condition: { kind: "desperation", hpThreshold: 10 },
		},
	},
	warDrum: {
		id: "warDrum",
		name: "War Drum",
		type: CardType.Buff,
		ability: "Boost damage of subsequent Strike cards (adjacent Strike required)",
		stats: {
			type: CardType.Buff,
			subtype: "formation",
			buffValue: { t1: 30, t2: 40, t3: 55 },
			buffTarget: "damage",
			affectedTypes: [CardType.Strike],
			condition: { kind: "formation", adjacentType: CardType.Strike },
		},
	},
	vanguard: {
		id: "vanguard",
		name: "Vanguard",
		type: CardType.Buff,
		ability: "Boost absorption of subsequent Shield cards (adjacent Shield required)",
		stats: {
			type: CardType.Buff,
			subtype: "formation",
			buffValue: { t1: 25, t2: 35, t3: 50 },
			buffTarget: "absorb",
			affectedTypes: [CardType.Shield],
			condition: { kind: "formation", adjacentType: CardType.Shield },
		},
	},

	// ═══════════════════════════════════════════════════
	// STRIKE (P3) — 6 cards
	// ═══════════════════════════════════════════════════
	slash: {
		id: "slash",
		name: "Slash",
		type: CardType.Strike,
		ability: "Pure damage",
		stats: {
			type: CardType.Strike,
			damage: { t1: 5, t2: 7, t3: 9 },
		},
	},
	pierce: {
		id: "pierce",
		name: "Pierce",
		type: CardType.Strike,
		ability: "Ignores 50% of shield",
		stats: {
			type: CardType.Strike,
			damage: { t1: 4, t2: 5, t3: 7 },
			effect: { kind: "pierce", shieldIgnorePercent: 50 },
		},
	},
	drain: {
		id: "drain",
		name: "Drain",
		type: CardType.Strike,
		ability: "Deals damage + heals you",
		stats: {
			type: CardType.Strike,
			damage: { t1: 3, t2: 4, t3: 6 },
			effect: { kind: "drain", healPerTier: { t1: 2, t2: 3, t3: 4 } },
		},
	},
	twinStrike: {
		id: "twinStrike",
		name: "Twin Strike",
		type: CardType.Strike,
		ability: "Hits twice (each hit buffed independently)",
		stats: {
			type: CardType.Strike,
			damage: { t1: 2, t2: 3, t3: 4 },
			effect: { kind: "twinStrike" },
		},
	},
	riposte: {
		id: "riposte",
		name: "Riposte",
		type: CardType.Strike,
		ability: "Bonus damage if enemy played Disrupt this lane",
		stats: {
			type: CardType.Strike,
			damage: { t1: 3, t2: 4, t3: 5 },
			effect: { kind: "riposte", bonusDamage: { t1: 4, t2: 5, t3: 7 } },
		},
	},
	executioner: {
		id: "executioner",
		name: "Executioner",
		type: CardType.Strike,
		ability: "Bonus damage if enemy HP ≤ 10",
		stats: {
			type: CardType.Strike,
			damage: { t1: 3, t2: 4, t3: 5 },
			effect: { kind: "executioner", bonusDamage: { t1: 4, t2: 5, t3: 7 }, hpThreshold: 10 },
		},
	},

	// ═══════════════════════════════════════════════════
	// NUKE (P4) — 4 cards
	// ═══════════════════════════════════════════════════
	meteor: {
		id: "meteor",
		name: "Meteor",
		type: CardType.Nuke,
		ability: "Massive damage if enemy played no Shield this lane",
		stats: {
			type: CardType.Nuke,
			damage: { t1: 10, t2: 13, t3: 16 },
			condition: { kind: "noShield" },
		},
	},
	guillotine: {
		id: "guillotine",
		name: "Guillotine",
		type: CardType.Nuke,
		ability: "Massive damage if enemy HP ≤ 10",
		stats: {
			type: CardType.Nuke,
			damage: { t1: 12, t2: 15, t3: 18 },
			condition: { kind: "lowHp", hpThreshold: 10 },
		},
	},
	ambush: {
		id: "ambush",
		name: "Ambush",
		type: CardType.Nuke,
		ability: "Massive damage if this card was in Shadow zone",
		stats: {
			type: CardType.Nuke,
			damage: { t1: 9, t2: 12, t3: 15 },
			condition: { kind: "fromShadow" },
		},
	},
	despair: {
		id: "despair",
		name: "Despair",
		type: CardType.Nuke,
		ability: "Massive damage if your HP < enemy HP",
		stats: {
			type: CardType.Nuke,
			damage: { t1: 11, t2: 14, t3: 17 },
			condition: { kind: "hpDisadvantage" },
		},
	},
};

export const CATALOG_IDS = Object.keys(CARD_CATALOG);
export const CATALOG_LIST = Object.values(CARD_CATALOG);
