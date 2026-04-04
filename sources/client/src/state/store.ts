import type { GameState, MatchState } from "@game/shared";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "relay";

export interface GameStore {
	matchState: MatchState | null;
	gameState: GameState | null;
	playerId: string | null;
	isHost: boolean;
	connectionStatus: ConnectionStatus;
	listeners: Set<() => void>;
}

export function createStore(): GameStore {
	return {
		matchState: null,
		gameState: null,
		playerId: null,
		isHost: false,
		connectionStatus: "disconnected",
		listeners: new Set(),
	};
}

export function subscribe(store: GameStore, listener: () => void): () => void {
	store.listeners.add(listener);
	return () => store.listeners.delete(listener);
}

export function updateStore(
	store: GameStore,
	partial: Partial<Omit<GameStore, "listeners">>,
): void {
	Object.assign(store, partial);
	for (const listener of store.listeners) {
		listener();
	}
}
