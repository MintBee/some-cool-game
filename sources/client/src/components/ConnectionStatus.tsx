import type { ConnectionStatus as Status } from "../state/store.js";

interface ConnectionStatusProps {
	status: Status;
}

const STATUS_COLORS: Record<Status, string> = {
	disconnected: "#ef4444",
	connecting: "#f59e0b",
	connected: "#22c55e",
	relay: "#3b82f6",
};

const STATUS_LABELS: Record<Status, string> = {
	disconnected: "Disconnected",
	connecting: "Connecting...",
	connected: "Connected (P2P)",
	relay: "Connected (Relay)",
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "6px",
				fontSize: "11px",
				color: STATUS_COLORS[status],
			}}
		>
			<div
				style={{
					width: "6px",
					height: "6px",
					borderRadius: "50%",
					background: STATUS_COLORS[status],
				}}
			/>
			{STATUS_LABELS[status]}
		</div>
	);
}
