import { describe, expect, it } from "vitest";
import { CardType, Tier } from "../../types/card.js";
import { CATALOG_LIST } from "../catalog.js";
import { CARD_CATALOG } from "../catalog.js";
import { createCard, upgradeCard } from "../scaling.js";

describe("Card Scaling", () => {
	it("creates cards at each tier with correct stats", () => {
		const slash = CARD_CATALOG.slash;
		const t1 = createCard(slash, Tier.T1);
		const t2 = createCard(slash, Tier.T2);
		const t3 = createCard(slash, Tier.T3);

		expect(t1.damage).toBe(5);
		expect(t2.damage).toBe(7);
		expect(t3.damage).toBe(9);
		expect(t1.tier).toBe(Tier.T1);
		expect(t2.tier).toBe(Tier.T2);
		expect(t3.tier).toBe(Tier.T3);
	});

	it("T2 stats > T1 and T3 stats > T2 for all cards", () => {
		for (const def of CATALOG_LIST) {
			const t1 = createCard(def, Tier.T1);
			const t2 = createCard(def, Tier.T2);
			const t3 = createCard(def, Tier.T3);

			// At least one stat should be greater at each tier
			const primaryStat = (c: ReturnType<typeof createCard>) => {
				switch (def.type) {
					case CardType.Disrupt:
						return c.weakenPercent;
					case CardType.Shield:
						return c.absorb;
					case CardType.Buff:
						return c.buffValue;
					case CardType.Strike:
					case CardType.Nuke:
						return c.damage;
				}
			};

			expect(primaryStat(t2)).toBeGreaterThan(primaryStat(t1));
			expect(primaryStat(t3)).toBeGreaterThan(primaryStat(t2));
		}
	});

	it("upgradeCard increases tier by 1", () => {
		const slash = CARD_CATALOG.slash;
		const t1 = createCard(slash, Tier.T1);
		const t2 = upgradeCard(t1, CARD_CATALOG);

		expect(t2.tier).toBe(Tier.T2);
		expect(t2.damage).toBeGreaterThan(t1.damage);
	});

	it("upgradeCard at T3 returns same card", () => {
		const slash = CARD_CATALOG.slash;
		const t3 = createCard(slash, Tier.T3);
		const result = upgradeCard(t3, CARD_CATALOG);

		expect(result).toBe(t3);
	});

	it("card id includes tier", () => {
		const card = createCard(CARD_CATALOG.barrier, Tier.T2);
		expect(card.id).toBe("barrier_t2");
	});
});
