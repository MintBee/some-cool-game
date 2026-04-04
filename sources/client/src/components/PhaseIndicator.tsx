interface PhaseIndicatorProps {
	phase: string;
	round: number;
}

export function PhaseIndicator({ phase, round }: PhaseIndicatorProps) {
	return (
		<div
			style={{
				textAlign: "center",
				padding: "8px 16px",
				background: "#111",
				borderRadius: "8px",
				border: "1px solid #333",
			}}
		>
			<div style={{ fontSize: "14px", color: "#e0e0e0", fontWeight: "bold" }}>{phase}</div>
			<div style={{ fontSize: "12px", color: "#888" }}>Round {round}</div>
		</div>
	);
}
