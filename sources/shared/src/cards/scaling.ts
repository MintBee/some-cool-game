import type { Card, CardDefinition, Tier, TierStats } from "../types/card.js";
import { CardType, Tier as TierEnum } from "../types/card.js";

const TIER_KEY: Record<number, keyof TierStats> = {
	1: "t1",
	2: "t2",
	3: "t3",
};

function getStat(tierStats: TierStats, tier: Tier): number {
	return tierStats[TIER_KEY[tier]];
}

/** Create a playable Card instance from a CardDefinition at a specific tier */
export function createCard(def: CardDefinition, tier: Tier): Card {
	const stats = def.stats;
	let damage = 0;
	let absorb = 0;
	let weakenPercent = 0;
	let chipDamage = 0;
	let buffValue = 0;

	switch (stats.type) {
		case CardType.Disrupt:
			weakenPercent = getStat(stats.weakenPercent, tier);
			chipDamage = getStat(stats.chipDamage, tier);
			break;
		case CardType.Shield:
			absorb = getStat(stats.absorb, tier);
			break;
		case CardType.Buff:
			buffValue = getStat(stats.buffValue, tier);
			break;
		case CardType.Strike:
			damage = getStat(stats.damage, tier);
			break;
		case CardType.Nuke:
			damage = getStat(stats.damage, tier);
			break;
	}

	return {
		id: `${def.id}_t${tier}`,
		name: def.name,
		type: def.type,
		tier: tier as TierEnum,
		ability: def.ability,
		damage,
		absorb,
		weakenPercent,
		chipDamage,
		buffValue,
		definitionId: def.id,
	};
}

/** Upgrade a card to the next tier. Returns new card or same if already T3. */
export function upgradeCard(card: Card, catalog: Record<string, CardDefinition>): Card {
	if (card.tier >= TierEnum.T3) return card;
	const def = catalog[card.definitionId];
	if (!def) return card;
	return createCard(def, (card.tier + 1) as Tier);
}
