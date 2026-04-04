import { describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { RoomManager } from "../RoomManager.js";

function mockWs(): WebSocket {
	const sent: string[] = [];
	return {
		readyState: 1, // OPEN
		OPEN: 1,
		send: vi.fn((msg: string) => sent.push(msg)),
		_sent: sent,
	} as unknown as WebSocket & { _sent: string[] };
}

function parseSent(ws: WebSocket & { _sent?: string[] }): unknown[] {
	return (
		(ws as { send: { mock: { calls: [string][] } } }).send as unknown as {
			mock: { calls: [string][] };
		}
	).mock.calls.map(([msg]: [string]) => JSON.parse(msg));
}

describe("RoomManager", () => {
	it("creates a room on first join and sends roomJoined", () => {
		const rm = new RoomManager();
		const ws = mockWs();
		const result = rm.joinRoom("lobby-1", "alice", ws);

		expect(result.ok).toBe(true);
		expect(result.room?.id).toBe("lobby-1");

		const messages = parseSent(ws);
		const roomJoined = messages.find(
			(m: unknown) => (m as Record<string, unknown>).type === "roomJoined",
		);
		expect(roomJoined).toBeDefined();
		expect((roomJoined as Record<string, unknown>).hostId).toBe("alice");
	});

	it("first joiner becomes host", () => {
		const rm = new RoomManager();
		const ws1 = mockWs();
		const ws2 = mockWs();
		rm.joinRoom("lobby-1", "alice", ws1);
		rm.joinRoom("lobby-1", "bob", ws2);

		const room = rm.getRoom("lobby-1");
		expect(room?.hostId).toBe("alice");
	});

	it("2 players → room locks → matchStarted emitted to both", () => {
		const rm = new RoomManager();
		const ws1 = mockWs();
		const ws2 = mockWs();
		rm.joinRoom("lobby-1", "alice", ws1);
		rm.joinRoom("lobby-1", "bob", ws2);

		const room = rm.getRoom("lobby-1");
		expect(room?.locked).toBe(true);

		const msgs1 = parseSent(ws1);
		const msgs2 = parseSent(ws2);

		expect(msgs1.some((m: unknown) => (m as Record<string, unknown>).type === "matchStarted")).toBe(
			true,
		);
		expect(msgs2.some((m: unknown) => (m as Record<string, unknown>).type === "matchStarted")).toBe(
			true,
		);
	});

	it("rejects join to locked room", () => {
		const rm = new RoomManager();
		rm.joinRoom("lobby-1", "alice", mockWs());
		rm.joinRoom("lobby-1", "bob", mockWs());

		const ws3 = mockWs();
		const result = rm.joinRoom("lobby-1", "charlie", ws3);
		expect(result.ok).toBe(false);
		expect(result.reason).toBe("Room is locked");
	});

	it("rejects join to full room", () => {
		const rm = new RoomManager();
		rm.joinRoom("lobby-1", "alice", mockWs());
		// Room capacity is 2 by default, so bob fills it
		rm.joinRoom("lobby-1", "bob", mockWs());

		const result = rm.joinRoom("lobby-1", "charlie", mockWs());
		expect(result.ok).toBe(false);
	});

	it("relays SDP messages to correct target", () => {
		const rm = new RoomManager();
		const ws1 = mockWs();
		const ws2 = mockWs();
		rm.joinRoom("lobby-1", "alice", ws1);
		rm.joinRoom("lobby-1", "bob", ws2);

		rm.relay("lobby-1", "alice", "bob", {
			type: "sdpOffer",
			sdp: "test-sdp",
		});

		const msgs = parseSent(ws2);
		const offer = msgs.find((m: unknown) => (m as Record<string, unknown>).type === "sdpOffer");
		expect(offer).toBeDefined();
		expect((offer as Record<string, string>).from).toBe("alice");
		expect((offer as Record<string, string>).sdp).toBe("test-sdp");
	});

	it("leave removes player and cleans empty rooms", () => {
		const rm = new RoomManager();
		rm.joinRoom("lobby-1", "alice", mockWs());
		rm.leaveRoom("lobby-1", "alice");

		expect(rm.getRoom("lobby-1")).toBeUndefined();
	});
});
