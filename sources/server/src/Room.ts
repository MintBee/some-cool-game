import type { WebSocket } from "ws";

export interface Peer {
	id: string;
	ws: WebSocket;
}

export class Room {
	readonly id: string;
	readonly capacity: number;
	readonly peers: Peer[] = [];
	locked = false;
	hostId: string | null = null;

	constructor(id: string, capacity: 2 | 4 | 6 = 2) {
		this.id = id;
		this.capacity = capacity;
	}

	get isFull(): boolean {
		return this.peers.length >= this.capacity;
	}

	get playerIds(): string[] {
		return this.peers.map((p) => p.id);
	}

	addPeer(peer: Peer): { ok: boolean; reason?: string } {
		if (this.locked) return { ok: false, reason: "Room is locked" };
		if (this.isFull) return { ok: false, reason: "Room is full" };
		if (this.peers.some((p) => p.id === peer.id)) {
			return { ok: false, reason: "Player already in room" };
		}

		this.peers.push(peer);

		// First player is host
		if (this.hostId === null) {
			this.hostId = peer.id;
		}

		return { ok: true };
	}

	removePeer(peerId: string): void {
		const idx = this.peers.findIndex((p) => p.id === peerId);
		if (idx !== -1) this.peers.splice(idx, 1);
	}

	getPeer(peerId: string): Peer | undefined {
		return this.peers.find((p) => p.id === peerId);
	}

	lock(): void {
		this.locked = true;
	}

	broadcast(message: string, excludeId?: string): void {
		for (const peer of this.peers) {
			if (peer.id !== excludeId && peer.ws.readyState === peer.ws.OPEN) {
				peer.ws.send(message);
			}
		}
	}

	sendTo(peerId: string, message: string): void {
		const peer = this.getPeer(peerId);
		if (peer && peer.ws.readyState === peer.ws.OPEN) {
			peer.ws.send(message);
		}
	}
}
