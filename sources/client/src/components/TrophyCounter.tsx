import { TROPHIES_TO_WIN } from "@game/shared";

interface TrophyCounterProps {
	myTrophies: number;
	opponentTrophies: number;
}

export function TrophyCounter({ myTrophies, opponentTrophies }: TrophyCounterProps) {
	return (
		<div
			style={{
				display: "flex",
				justifyContent: "center",
				gap: "24px",
				fontSize: "16px",
				fontWeight: "bold",
			}}
		>
			<span style={{ color: "#22c55e" }}>
				You: {myTrophies}/{TROPHIES_TO_WIN}
			</span>
			<span style={{ color: "#666" }}>vs</span>
			<span style={{ color: "#ef4444" }}>
				Opp: {opponentTrophies}/{TROPHIES_TO_WIN}
			</span>
		</div>
	);
}
