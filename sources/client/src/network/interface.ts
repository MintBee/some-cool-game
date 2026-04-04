import type { Action } from "@game/shared";
import type { GameMessage } from "@game/shared";

export interface INetworkAdapter {
	/** Connect to a room on the signaling server */
	connect(serverUrl: string, roomId: string, playerId: string): Promise<void>;

	/** Send a game action to the host */
	sendAction(action: Action): void;

	/** Register callback for incoming game messages */
	onMessage(callback: (message: GameMessage) => void): void;

	/** Register callback for connection status changes */
	onStatusChange(
		callback: (status: "connecting" | "connected" | "relay" | "disconnected") => void,
	): void;

	/** Register callback for match started */
	onMatchStarted(
		callback: (data: { matchId: string; players: string[]; hostId: string }) => void,
	): void;

	/** Disconnect and clean up */
	disconnect(): void;

	/** Whether this peer is the host */
	isHost: boolean;
}
