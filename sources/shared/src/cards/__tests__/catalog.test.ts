import { describe, expect, it } from "vitest";
import { CardType } from "../../types/card.js";
import { CARD_CATALOG, CATALOG_LIST } from "../catalog.js";

describe("Card Catalog", () => {
	it("has exactly 22 cards", () => {
		expect(CATALOG_LIST.length).toBe(22);
	});

	it("has correct type distribution: 4 Disrupt, 4 Shield, 4 Buff, 6 Strike, 4 Nuke", () => {
		const counts = new Map<CardType, number>();
		for (const card of CATALOG_LIST) {
			counts.set(card.type, (counts.get(card.type) ?? 0) + 1);
		}
		expect(counts.get(CardType.Disrupt)).toBe(4);
		expect(counts.get(CardType.Shield)).toBe(4);
		expect(counts.get(CardType.Buff)).toBe(4);
		expect(counts.get(CardType.Strike)).toBe(6);
		expect(counts.get(CardType.Nuke)).toBe(4);
	});

	it("every card has required fields", () => {
		for (const card of CATALOG_LIST) {
			expect(card.id).toBeTruthy();
			expect(card.name).toBeTruthy();
			expect(card.type).toBeTruthy();
			expect(card.ability).toBeTruthy();
			expect(card.stats).toBeTruthy();
			expect(card.stats.type).toBe(card.type);
		}
	});

	it("every card id matches its key in the catalog", () => {
		for (const [key, card] of Object.entries(CARD_CATALOG)) {
			expect(card.id).toBe(key);
		}
	});

	it("all card ids are unique", () => {
		const ids = CATALOG_LIST.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
