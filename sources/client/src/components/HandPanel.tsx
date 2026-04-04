import { TYPE_COLORS } from "../renderer/svg/constants.js";
import type { CardView } from "../state/ViewModel.js";

interface HandPanelProps {
	cards: CardView[];
	onDeploy: (cardId: string) => void;
}

export function HandPanel({ cards, onDeploy }: HandPanelProps) {
	if (cards.length === 0) return null;

	return (
		<div
			style={{
				position: "absolute",
				bottom: "8px",
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				gap: "8px",
				background: "#0a0a0a",
				padding: "8px",
				borderRadius: "8px",
				border: "1px solid #222",
			}}
		>
			{cards.map((card) => {
				const color = TYPE_COLORS[card.type] ?? "#666";
				return (
					<button
						type="button"
						key={card.id}
						onClick={() => onDeploy(card.id)}
						style={{
							background: "#111",
							border: `1px solid ${color}`,
							borderRadius: "6px",
							padding: "8px 12px",
							cursor: "pointer",
							color: "#e0e0e0",
							fontSize: "11px",
							minWidth: "80px",
						}}
					>
						<div style={{ fontWeight: "bold" }}>{card.name}</div>
						<div style={{ fontSize: "10px", color }}>{card.type}</div>
					</button>
				);
			})}
		</div>
	);
}
