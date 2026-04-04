import gsap from "gsap";
import { getLaneX } from "./Board.js";
import { CARD_HEIGHT, CARD_WIDTH, OPPONENT_Y, PLAYER_Y, SVG_NS, TYPE_COLORS } from "./constants.js";

/** Animate a card deploying into a slot */
export function animateDeploy(
	cardGroup: SVGGElement,
	laneIndex: number,
	isPlayer: boolean,
): Promise<void> {
	const x = getLaneX(laneIndex);
	const y = isPlayer ? PLAYER_Y : OPPONENT_Y;

	// Start off-screen
	gsap.set(cardGroup, { attr: { transform: `translate(${x}, ${isPlayer ? 800 : -200})` } });

	return new Promise((resolve) => {
		gsap.to(cardGroup, {
			attr: { transform: `translate(${x}, ${y})` },
			duration: 0.4,
			ease: "back.out(1.4)",
			onComplete: resolve,
		});
	});
}

/** Animate a lane reveal: flip both cards and show result */
export function animateLaneReveal(
	playerCard: SVGGElement,
	opponentCard: SVGGElement,
	laneIndex: number,
	winner: "A" | "B" | "draw",
): Promise<void> {
	const tl = gsap.timeline();

	// Flip effect: scale X to 0 then back to 1
	tl.to(opponentCard, { attr: { "transform-origin": "center" }, scaleX: 0, duration: 0.15 });
	tl.to(opponentCard, { scaleX: 1, duration: 0.15 });

	// Pause for dramatic effect (not addPause — use empty tween per wiki gotchas)
	tl.to({}, { duration: 0.3 });

	// Resolution flash
	const x = getLaneX(laneIndex) + CARD_WIDTH / 2;
	const centerY = (PLAYER_Y + OPPONENT_Y + CARD_HEIGHT) / 2;

	tl.call(() => {
		const svg = playerCard.ownerSVGElement;
		if (!svg) return;
		const effectsLayer = svg.getElementById("effects-layer");
		if (!effectsLayer) return;

		const color = winner === "draw" ? "#666" : winner === "A" ? "#22c55e" : "#ef4444";

		const flash = document.createElementNS(SVG_NS, "circle");
		flash.setAttribute("cx", String(x));
		flash.setAttribute("cy", String(centerY));
		flash.setAttribute("r", "0");
		flash.setAttribute("fill", color);
		flash.setAttribute("opacity", "0.6");
		flash.setAttribute("data-effect", "true");
		effectsLayer.appendChild(flash);

		gsap.to(flash, {
			attr: { r: 60 },
			opacity: 0,
			duration: 0.5,
			onComplete: () => flash.remove(),
		});

		// Persistent result indicator
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

		gsap.from(indicator, { opacity: 0, duration: 0.3, delay: 0.3 });
	});

	tl.to({}, { duration: 0.3 });

	return new Promise((resolve) => {
		tl.call(resolve);
	});
}

/** Animate HP change */
export function animateHpChange(
	hpBar: HTMLElement,
	fromHp: number,
	toHp: number,
	maxHp: number,
): void {
	const targetPercent = Math.max(0, (toHp / maxHp) * 100);
	gsap.to(hpBar, {
		width: `${targetPercent}%`,
		duration: 0.5,
		ease: "power2.out",
	});
}

/** Cleanup all effect elements */
export function cleanupEffects(svg: SVGSVGElement): void {
	const effects = svg.querySelectorAll("[data-effect]");
	for (const el of effects) el.remove();
}
