import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import { RoomManager } from "./RoomManager.js";

interface ClientState {
	playerId: string | null;
	roomId: string | null;
}

export class SignalingServer {
	private wss: WebSocketServer;
	private roomManager = new RoomManager();
	private clients = new Map<WebSocket, ClientState>();

	constructor(server: Server) {
		this.wss = new WebSocketServer({ server });
		this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
	}

	private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
		this.clients.set(ws, { playerId: null, roomId: null });

		ws.on("message", (data) => {
			try {
				const msg = JSON.parse(data.toString());
				this.handleMessage(ws, msg);
			} catch {
				ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
			}
		});

		ws.on("close", () => {
			const state = this.clients.get(ws);
			if (state?.roomId && state.playerId) {
				this.roomManager.leaveRoom(state.roomId, state.playerId);
			}
			this.clients.delete(ws);
		});
	}

	private handleMessage(ws: WebSocket, msg: Record<string, unknown>): void {
		const state = this.clients.get(ws);
		if (!state) return;

		switch (msg.type) {
			case "joinRoom": {
				const roomId = msg.roomId as string;
				const playerId = msg.playerId as string;
				const capacity = (msg.capacity as 2 | 4 | 6) || 2;

				if (!roomId || !playerId) {
					ws.send(JSON.stringify({ type: "error", message: "Missing roomId or playerId" }));
					return;
				}

				const result = this.roomManager.joinRoom(roomId, playerId, ws, capacity);
				if (!result.ok) {
					ws.send(JSON.stringify({ type: "error", message: result.reason }));
					return;
				}

				state.playerId = playerId;
				state.roomId = roomId;
				break;
			}

			case "sdpOffer":
			case "sdpAnswer":
			case "iceCandidate": {
				const targetId = msg.target as string;
				if (!state.roomId || !state.playerId || !targetId) return;
				this.roomManager.relay(state.roomId, state.playerId, targetId, msg);
				break;
			}

			case "leaveRoom": {
				if (state.roomId && state.playerId) {
					this.roomManager.leaveRoom(state.roomId, state.playerId);
					state.roomId = null;
				}
				break;
			}
		}
	}

	close(): void {
		this.wss.close();
	}
}
