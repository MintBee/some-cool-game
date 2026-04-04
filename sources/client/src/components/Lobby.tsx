import { useState } from "preact/hooks";

interface LobbyProps {
	onJoin: (roomId: string, playerId: string) => void;
	playerCount?: number;
	capacity?: number;
}

export function Lobby({ onJoin, playerCount = 0, capacity = 2 }: LobbyProps) {
	const [roomId, setRoomId] = useState("");
	const [playerId] = useState(() => `player-${Math.random().toString(36).slice(2, 7)}`);
	const [status, setStatus] = useState<"idle" | "joining" | "waiting">("idle");

	const handleJoin = () => {
		if (!roomId.trim()) return;
		setStatus("joining");
		onJoin(roomId.trim(), playerId);
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: "16px",
			}}
		>
			<h1 style={{ color: "#e0e0e0", fontSize: "24px" }}>Card Battle Game</h1>

			<div style={{ color: "#888", fontSize: "12px" }}>Your ID: {playerId}</div>

			<div style={{ display: "flex", gap: "8px" }}>
				<input
					type="text"
					placeholder="Room name"
					value={roomId}
					onInput={(e) => setRoomId((e.target as HTMLInputElement).value)}
					onKeyDown={(e) => e.key === "Enter" && handleJoin()}
					style={{
						padding: "8px 16px",
						background: "#111",
						border: "1px solid #333",
						borderRadius: "6px",
						color: "#e0e0e0",
						fontSize: "14px",
						outline: "none",
					}}
				/>
				<button
					type="button"
					onClick={handleJoin}
					disabled={status !== "idle" || !roomId.trim()}
					style={{
						padding: "8px 24px",
						background: status === "idle" ? "#22c55e" : "#333",
						color: status === "idle" ? "#000" : "#888",
						border: "none",
						borderRadius: "6px",
						fontWeight: "bold",
						cursor: status === "idle" ? "pointer" : "default",
						fontSize: "14px",
					}}
				>
					{status === "idle" ? "Join" : status === "joining" ? "Joining..." : "Waiting..."}
				</button>
			</div>

			{status !== "idle" && playerCount > 0 && (
				<div style={{ color: "#888", fontSize: "14px" }}>
					Waiting for opponent... ({playerCount}/{capacity} players)
				</div>
			)}
		</div>
	);
}
