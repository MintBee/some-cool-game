import {
	BOARD_HEIGHT,
	BOARD_WIDTH,
	CARD_HEIGHT,
	CARD_WIDTH,
	LANE_COUNT,
	LANE_GAP,
	LANE_START_X,
	OPPONENT_Y,
	PLAYER_Y,
	SVG_NS,
} from "./constants.js";

export function createBoard(): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", `0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`);
	svg.setAttribute("width", "100%");
	svg.setAttribute("height", "100%");
	svg.style.display = "block";
	svg.style.background = "#0a0a0a";

	// Board background
	const bg = document.createElementNS(SVG_NS, "rect");
	bg.setAttribute("width", String(BOARD_WIDTH));
	bg.setAttribute("height", String(BOARD_HEIGHT));
	bg.setAttribute("fill", "#0a0a0a");
	svg.appendChild(bg);

	// Center divider line
	const divider = document.createElementNS(SVG_NS, "line");
	divider.setAttribute("x1", "0");
	divider.setAttribute("y1", String(BOARD_HEIGHT / 2));
	divider.setAttribute("x2", String(BOARD_WIDTH));
	divider.setAttribute("y2", String(BOARD_HEIGHT / 2));
	divider.setAttribute("stroke", "#222");
	divider.setAttribute("stroke-width", "1");
	divider.setAttribute("stroke-dasharray", "8 4");
	svg.appendChild(divider);

	// Lane slot outlines
	for (let i = 0; i < LANE_COUNT; i++) {
		const x = LANE_START_X + i * (CARD_WIDTH + LANE_GAP);

		// Opponent slot (top)
		const oppSlot = document.createElementNS(SVG_NS, "rect");
		oppSlot.setAttribute("x", String(x));
		oppSlot.setAttribute("y", String(OPPONENT_Y));
		oppSlot.setAttribute("width", String(CARD_WIDTH));
		oppSlot.setAttribute("height", String(CARD_HEIGHT));
		oppSlot.setAttribute("rx", "8");
		oppSlot.setAttribute("fill", "none");
		oppSlot.setAttribute("stroke", "#1a1a2e");
		oppSlot.setAttribute("stroke-width", "1");
		oppSlot.setAttribute("data-slot", `opp-${i}`);
		svg.appendChild(oppSlot);

		// Player slot (bottom)
		const playerSlot = document.createElementNS(SVG_NS, "rect");
		playerSlot.setAttribute("x", String(x));
		playerSlot.setAttribute("y", String(PLAYER_Y));
		playerSlot.setAttribute("width", String(CARD_WIDTH));
		playerSlot.setAttribute("height", String(CARD_HEIGHT));
		playerSlot.setAttribute("rx", "8");
		playerSlot.setAttribute("fill", "none");
		playerSlot.setAttribute("stroke", "#1a1a2e");
		playerSlot.setAttribute("stroke-width", "1");
		playerSlot.setAttribute("data-slot", `player-${i}`);
		svg.appendChild(playerSlot);

		// Lane number
		const laneNum = document.createElementNS(SVG_NS, "text");
		laneNum.setAttribute("x", String(x + CARD_WIDTH / 2));
		laneNum.setAttribute("y", String(BOARD_HEIGHT / 2 + 5));
		laneNum.setAttribute("text-anchor", "middle");
		laneNum.setAttribute("fill", "#333");
		laneNum.setAttribute("font-size", "12");
		laneNum.textContent = String(i + 1);
		svg.appendChild(laneNum);
	}

	// Container groups for cards (layered above slots)
	const opponentCards = document.createElementNS(SVG_NS, "g");
	opponentCards.setAttribute("id", "opponent-cards");
	svg.appendChild(opponentCards);

	const playerCards = document.createElementNS(SVG_NS, "g");
	playerCards.setAttribute("id", "player-cards");
	svg.appendChild(playerCards);

	// Effects layer (topmost)
	const effectsLayer = document.createElementNS(SVG_NS, "g");
	effectsLayer.setAttribute("id", "effects-layer");
	svg.appendChild(effectsLayer);

	return svg;
}

export function getLaneX(laneIndex: number): number {
	return LANE_START_X + laneIndex * (CARD_WIDTH + LANE_GAP);
}
