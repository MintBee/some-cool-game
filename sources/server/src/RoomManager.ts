import type { WebSocket } from "ws";
import { type Peer, Room } from "./Room.js";

export class RoomManager {
	private rooms = new Map<string, Room>();

	joinRoom(
		roomId: string,
		playerId: string,
		ws: WebSocket,
		capacity: 2 | 4 | 6 = 2,
	): { ok: boolean; reason?: string; room?: Room } {
		let room = this.rooms.get(roomId);

		if (!room) {
			room = new Room(roomId, capacity);
			this.rooms.set(roomId, room);
		}

		const peer: Peer = { id: playerId, ws };
		const result = room.addPeer(peer);

		if (!result.ok) return result;

		// Notify existing players about the new player
		room.broadcast(
			JSON.stringify({
				type: "peerJoined",
				playerId,
				playerCount: room.peers.length,
				capacity: room.capacity,
			}),
			playerId,
		);

		// Send room state to the new player
		peer.ws.send(
			JSON.stringify({
				type: "roomJoined",
				roomId,
				playerId,
				players: room.playerIds,
				capacity: room.capacity,
				hostId: room.hostId,
			}),
		);

		// If room is full, lock and start match
		if (room.isFull) {
			room.lock();
			const matchStarted = JSON.stringify({
				type: "matchStarted",
				matchId: `${roomId}-${Date.now()}`,
				players: room.playerIds,
				hostId: room.hostId,
			});
			for (const p of room.peers) {
				if (p.ws.readyState === p.ws.OPEN) {
					p.ws.send(matchStarted);
				}
			}
		}

		return { ok: true, room };
	}

	leaveRoom(roomId: string, playerId: string): void {
		const room = this.rooms.get(roomId);
		if (!room) return;

		room.removePeer(playerId);
		room.broadcast(
			JSON.stringify({
				type: "peerLeft",
				playerId,
				playerCount: room.peers.length,
			}),
		);

		// Clean up empty rooms
		if (room.peers.length === 0) {
			this.rooms.delete(roomId);
		}
	}

	getRoom(roomId: string): Room | undefined {
		return this.rooms.get(roomId);
	}

	/** Relay SDP/ICE messages between peers in a room */
	relay(roomId: string, fromId: string, targetId: string, message: unknown): void {
		const room = this.rooms.get(roomId);
		if (!room) return;

		const target = room.getPeer(targetId);
		if (target && target.ws.readyState === target.ws.OPEN) {
			target.ws.send(
				JSON.stringify({
					...(message as Record<string, unknown>),
					from: fromId,
				}),
			);
		}
	}
}
