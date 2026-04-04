import type { CardView, OpponentCardView } from "../../state/ViewModel.js";
import { CARD_HEIGHT, CARD_WIDTH, SVG_NS, TYPE_COLORS } from "./constants.js";

export function createCardElement(card: CardView): SVGGElement {
	const g = document.createElementNS(SVG_NS, "g");
	g.setAttribute("data-card-id", card.id);

	const color = TYPE_COLORS[card.type] ?? "#666";

	// Background rect
	const rect = document.createElementNS(SVG_NS, "rect");
	rect.setAttribute("width", String(CARD_WIDTH));
	rect.setAttribute("height", String(CARD_HEIGHT));
	rect.setAttribute("rx", "8");
	rect.setAttribute("fill", color);
	rect.setAttribute("fill-opacity", "0.15");
	rect.setAttribute("stroke", color);
	rect.setAttribute("stroke-width", "2");
	g.appendChild(rect);

	// Card name
	const nameText = document.createElementNS(SVG_NS, "text");
	nameText.setAttribute("x", String(CARD_WIDTH / 2));
	nameText.setAttribute("y", "28");
	nameText.setAttribute("text-anchor", "middle");
	nameText.setAttribute("fill", "#e0e0e0");
	nameText.setAttribute("font-size", "14");
	nameText.setAttribute("font-weight", "bold");
	nameText.textContent = card.name;
	g.appendChild(nameText);

	// Type label
	const typeText = document.createElementNS(SVG_NS, "text");
	typeText.setAttribute("x", String(CARD_WIDTH / 2));
	typeText.setAttribute("y", "50");
	typeText.setAttribute("text-anchor", "middle");
	typeText.setAttribute("fill", color);
	typeText.setAttribute("font-size", "11");
	typeText.textContent = `${card.type} T${card.tier}`;
	g.appendChild(typeText);

	// Stats
	const statsText = document.createElementNS(SVG_NS, "text");
	statsText.setAttribute("x", String(CARD_WIDTH / 2));
	statsText.setAttribute("y", "75");
	statsText.setAttribute("text-anchor", "middle");
	statsText.setAttribute("fill", "#aaa");
	statsText.setAttribute("font-size", "12");
	if (card.damage > 0) statsText.textContent = `DMG ${card.damage}`;
	else if (card.absorb > 0) statsText.textContent = `ABS ${card.absorb}`;
	else statsText.textContent = "";
	g.appendChild(statsText);

	// Ability text (wrapped)
	const abilityText = document.createElementNS(SVG_NS, "text");
	abilityText.setAttribute("x", String(CARD_WIDTH / 2));
	abilityText.setAttribute("y", "100");
	abilityText.setAttribute("text-anchor", "middle");
	abilityText.setAttribute("fill", "#888");
	abilityText.setAttribute("font-size", "10");
	// Truncate long ability text
	const maxLen = 20;
	abilityText.textContent =
		card.ability.length > maxLen ? `${card.ability.slice(0, maxLen)}...` : card.ability;
	g.appendChild(abilityText);

	return g;
}

export function createOpponentCardElement(view: OpponentCardView): SVGGElement {
	const g = document.createElementNS(SVG_NS, "g");

	if (view.visibility === "full" && view.card) {
		return createCardElement(view.card);
	}

	const rect = document.createElementNS(SVG_NS, "rect");
	rect.setAttribute("width", String(CARD_WIDTH));
	rect.setAttribute("height", String(CARD_HEIGHT));
	rect.setAttribute("rx", "8");

	if (view.visibility === "typeOnly" && view.type) {
		const color = TYPE_COLORS[view.type] ?? "#666";
		rect.setAttribute("fill", "#1a1a2e");
		rect.setAttribute("stroke", color);
		rect.setAttribute("stroke-width", "2");
		g.appendChild(rect);

		const typeText = document.createElementNS(SVG_NS, "text");
		typeText.setAttribute("x", String(CARD_WIDTH / 2));
		typeText.setAttribute("y", String(CARD_HEIGHT / 2));
		typeText.setAttribute("text-anchor", "middle");
		typeText.setAttribute("dominant-baseline", "middle");
		typeText.setAttribute("fill", color);
		typeText.setAttribute("font-size", "14");
		typeText.textContent = view.type;
		g.appendChild(typeText);
	} else {
		// Fully hidden
		rect.setAttribute("fill", "#1a1a2e");
		rect.setAttribute("stroke", "#333");
		rect.setAttribute("stroke-width", "2");
		g.appendChild(rect);

		const qText = document.createElementNS(SVG_NS, "text");
		qText.setAttribute("x", String(CARD_WIDTH / 2));
		qText.setAttribute("y", String(CARD_HEIGHT / 2));
		qText.setAttribute("text-anchor", "middle");
		qText.setAttribute("dominant-baseline", "middle");
		qText.setAttribute("fill", "#555");
		qText.setAttribute("font-size", "24");
		qText.textContent = "?";
		g.appendChild(qText);
	}

	return g;
}
