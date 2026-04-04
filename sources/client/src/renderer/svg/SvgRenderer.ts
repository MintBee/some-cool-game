import type { BoardViewModel, CardView, LaneView } from "../../state/ViewModel.js";
import type { IRenderAdapter } from "../interface.js";
import { animateDeploy, animateLaneReveal, cleanupEffects } from "./Animator.js";
import { createBoard, getLaneX } from "./Board.js";
import { createCardElement, createOpponentCardElement } from "./CardElement.js";
import { CARD_HEIGHT, CARD_WIDTH, OPPONENT_Y, PLAYER_Y, SVG_NS } from "./constants.js";

export class SvgRenderer implements IRenderAdapter {
	private svg: SVGSVGElement | null = null;
	private container: HTMLElement | null = null;

	mount(container: HTMLElement): void {
		this.container = container;
		this.svg = createBoard();
		container.appendChild(this.svg);
	}

	updateBoard(viewModel: BoardViewModel): void {
		if (!this.svg) return;

		// Clear existing card elements
		const playerGroup = this.svg.getElementById("player-cards");
		const oppGroup = this.svg.getElementById("opponent-cards");
		if (playerGroup) playerGroup.innerHTML = "";
		if (oppGroup) oppGroup.innerHTML = "";

		cleanupEffects(this.svg);

		// Render cards for each lane
		const effectsLayer = this.svg.getElementById("effects-layer");
		for (const lane of viewModel.lanes) {
			// Player card
			if (lane.myCard && playerGroup) {
				const el = createCardElement(lane.myCard);
				const x = getLaneX(lane.index);
				el.setAttribute("transform", `translate(${x}, ${PLAYER_Y})`);
				playerGroup.appendChild(el);
			}

			// Opponent card
			if (lane.opponentCard && oppGroup) {
				const el = createOpponentCardElement(lane.opponentCard);
				const x = getLaneX(lane.index);
				el.setAttribute("transform", `translate(${x}, ${OPPONENT_Y})`);
				oppGroup.appendChild(el);
			}

			// Lane result indicator
			if (lane.result && effectsLayer) {
				const x = getLaneX(lane.index) + CARD_WIDTH / 2;
				const centerY = (PLAYER_Y + OPPONENT_Y + CARD_HEIGHT) / 2;
				const winner = lane.result.winner;
				const color = winner === "draw" ? "#666" : winner === "A" ? "#22c55e" : "#ef4444";
				const label = winner === "draw" ? "Draw" : winner === "A" ? "Won" : "Lost";

				const indicator = document.createElementNS(SVG_NS, "text");
				indicator.setAttribute("x", String(x));
				indicator.setAttribute("y", String(centerY));
				indicator.setAttribute("text-anchor", "middle");
				indicator.setAttribute("dominant-baseline", "middle");
				indicator.setAttribute("fill", color);
				indicator.setAttribute("font-size", "13");
				indicator.setAttribute("font-weight", "bold");
				indicator.setAttribute("data-effect", "true");
				indicator.textContent = label;
				effectsLayer.appendChild(indicator);
			}
		}
	}

	async playDeploy(slot: number, card: CardView): Promise<void> {
		if (!this.svg) return;
		const playerGroup = this.svg.getElementById("player-cards");
		if (!playerGroup) return;

		const el = createCardElement(card);
		playerGroup.appendChild(el);
		await animateDeploy(el, slot, true);
	}

	async playLaneReveal(lane: LaneView): Promise<void> {
		if (!this.svg) return;

		const playerGroup = this.svg.getElementById("player-cards");
		const oppGroup = this.svg.getElementById("opponent-cards");
		if (!playerGroup || !oppGroup) return;

		// Find the card elements at this lane
		const playerCards = playerGroup.children;
		const oppCards = oppGroup.children;

		const playerCard = playerCards[lane.index] as SVGGElement | undefined;
		const oppCard = oppCards[lane.index] as SVGGElement | undefined;

		if (playerCard && oppCard && lane.result) {
			await animateLaneReveal(playerCard, oppCard, lane.index, lane.result.winner);
		}
	}

	destroy(): void {
		if (this.svg && this.container) {
			this.container.removeChild(this.svg);
		}
		this.svg = null;
		this.container = null;
	}
}
