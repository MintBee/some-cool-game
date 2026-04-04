import { TYPE_COLORS } from "../renderer/svg/constants.js";
import type { CardView } from "../state/ViewModel.js";

interface DraftPanelProps {
	choices: CardView[];
	onPick: (cardId: string) => void;
}

export function DraftPanel({ choices, onPick }: DraftPanelProps) {
	if (choices.length === 0) return null;

	return (
		<div
			style={{
				position: "absolute",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				background: "#111",
				border: "1px solid #333",
				borderRadius: "12px",
				padding: "24px",
				zIndex: 10,
			}}
		>
			<h3 style={{ color: "#e0e0e0", textAlign: "center", margin: "0 0 16px" }}>Choose a card</h3>
			<div style={{ display: "flex", gap: "16px" }}>
				{choices.map((card) => {
					const color = TYPE_COLORS[card.type] ?? "#666";
					return (
						<button
							type="button"
							key={card.id}
							onClick={() => onPick(card.id)}
							style={{
								background: "#1a1a2e",
								border: `2px solid ${color}`,
								borderRadius: "8px",
								padding: "16px",
								cursor: "pointer",
								width: "150px",
								textAlign: "center",
								color: "#e0e0e0",
							}}
						>
							<div style={{ fontWeight: "bold", marginBottom: "4px" }}>{card.name}</div>
							<div style={{ fontSize: "11px", color }}>
								{card.type} T{card.tier}
							</div>
							<div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>
								{card.ability}
							</div>
							{card.damage > 0 && (
								<div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
									DMG {card.damage}
								</div>
							)}
							{card.absorb > 0 && (
								<div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "4px" }}>
									ABS {card.absorb}
								</div>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
