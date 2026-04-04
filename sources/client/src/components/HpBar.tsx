import { STARTING_HP } from "@game/shared";

interface HpBarProps {
	hp: number;
	label: string;
	color: string;
}

export function HpBar({ hp, label, color }: HpBarProps) {
	const percent = Math.max(0, (hp / STARTING_HP) * 100);

	return (
		<div style={{ marginBottom: "8px" }}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					fontSize: "12px",
					color: "#aaa",
				}}
			>
				<span>{label}</span>
				<span>
					{hp}/{STARTING_HP}
				</span>
			</div>
			<div
				style={{
					width: "100%",
					height: "8px",
					background: "#222",
					borderRadius: "4px",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						width: `${percent}%`,
						height: "100%",
						background: color,
						borderRadius: "4px",
						transition: "width 0.5s ease-out",
					}}
				/>
			</div>
		</div>
	);
}
