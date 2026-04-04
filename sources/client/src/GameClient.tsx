import type { Action, Card, GameMessage, GameState, VisibleGameState } from "@game/shared";
import { useCallback, useRef, useState } from "preact/hooks";
import { App } from "./components/App.js";
import { ConnectionStatus } from "./components/ConnectionStatus.js";
import { Lobby } from "./components/Lobby.js";
import { HostEngine } from "./network/HostEngine.js";
import { P2PAdapter } from "./network/P2PAdapter.js";
import {
	type BoardViewModel,
	type CardView,
	deriveViewModel,
	deriveViewModelFromVisible,
} from "./state/ViewModel.js";
import type { ConnectionStatus as ConnStatus } from "./state/store.js";

type Screen = "lobby" | "game";

const SERVER_URL = `ws://${window.location.hostname}:3001`;

export function GameClient() {
	const [screen, setScreen] = useState<Screen>("lobby");
	const [connectionStatus, setConnectionStatus] = useState<ConnStatus>("disconnected");
	const [viewModel, setViewModel] = useState<BoardViewModel | null>(null);
	const [draftChoices, setDraftChoices] = useState<CardView[]>([]);
	const [playerId, setPlayerId] = useState("");
	const [lobbyPlayerCount, setLobbyPlayerCount] = useState(0);
	const [lobbyCapacity, setLobbyCapacity] = useState(2);

	const adapterRef = useRef<P2PAdapter | null>(null);
	const hostEngineRef = useRef<HostEngine | null>(null);

	const handleJoin = useCallback(async (roomId: string, pid: string) => {
		setPlayerId(pid);

		const adapter = new P2PAdapter();
		adapterRef.current = adapter;

		adapter.onStatusChange((status) => {
			setConnectionStatus(status);
		});

		adapter.onPeerCount((count, capacity) => {
			setLobbyPlayerCount(count);
			setLobbyCapacity(capacity);
		});

		adapter.onMatchStarted(({ matchId, players, hostId }) => {
			setScreen("game");

			if (adapter.isHost) {
				// Host creates the engine
				hostEngineRef.current = new HostEngine(
					adapter,
					players,
					matchId,
					hostId,
					(state: GameState) => {
						setViewModel(deriveViewModel(state, pid));
					},
				);
			}
		});

		adapter.onMessage((msg: GameMessage) => {
			switch (msg.type) {
				case "stateSync":
					setViewModel(deriveViewModelFromVisible(msg.state as unknown as VisibleGameState));
					break;

				case "draftChoices":
					setDraftChoices(
						msg.choices.map((c: Card) => ({
							id: c.id,
							name: c.name,
							type: c.type,
							tier: c.tier,
							damage: c.damage,
							absorb: c.absorb,
							ability: c.ability,
						})),
					);
					break;

				case "laneReveal":
					// The state sync will update the board
					break;

				case "battleResult":
					// The state sync will update trophies
					break;
			}
		});

		try {
			await adapter.connect(SERVER_URL, roomId, pid);
		} catch (e) {
			console.error("Failed to connect:", e);
			setConnectionStatus("disconnected");
		}
	}, []);

	const handlePick = useCallback(
		(cardId: string) => {
			if (!adapterRef.current) return;

			const definitionId = cardId.replace(/_t\d$/, "");

			if (hostEngineRef.current) {
				// Clear before synchronous handling — HostEngine may deliver new choices inline
				setDraftChoices([]);
				hostEngineRef.current.handleIncomingAction({
					type: "pickCard",
					playerId,
					cardId: definitionId,
				});
			} else {
				adapterRef.current.sendAction({
					type: "pickCard",
					playerId,
					cardId: definitionId,
				});
				setDraftChoices([]);
			}
		},
		[playerId],
	);

	const handleDeploy = useCallback(
		(cardId: string) => {
			if (!adapterRef.current || !viewModel) return;

			let action: Action;

			if (viewModel.phase === "BattlePrep") {
				// During BattlePrep: insert card at end of deployed sequence
				const deployedCount = viewModel.lanes.filter((l) => l.myCard).length;
				action = {
					type: "insertBattlePrep" as const,
					playerId,
					cardId,
					position: deployedCount,
				};
			} else {
				// During Prep: deploy to next empty slot
				const nextSlot = viewModel.lanes.findIndex((l) => !l.myCard);
				if (nextSlot === -1) return;
				action = {
					type: "deployCard" as const,
					playerId,
					cardId,
					slot: nextSlot,
				};
			}

			if (hostEngineRef.current) {
				hostEngineRef.current.handleIncomingAction(action);
			} else {
				adapterRef.current.sendAction(action);
			}
		},
		[playerId, viewModel],
	);

	const handleReady = useCallback(() => {
		if (!adapterRef.current) return;

		const action = {
			type: "ready" as const,
			playerId,
		};

		if (hostEngineRef.current) {
			hostEngineRef.current.handleIncomingAction(action);
		} else {
			adapterRef.current.sendAction(action);
		}
	}, [playerId]);

	if (screen === "lobby") {
		return (
			<div style={{ width: "100%", height: "100%", position: "relative" }}>
				<Lobby onJoin={handleJoin} playerCount={lobbyPlayerCount} capacity={lobbyCapacity} />
				<div style={{ position: "absolute", top: "8px", right: "8px" }}>
					<ConnectionStatus status={connectionStatus} />
				</div>
			</div>
		);
	}

	if (!viewModel) {
		return (
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#888",
				}}
			>
				Setting up game...
				<div style={{ position: "absolute", top: "8px", right: "8px" }}>
					<ConnectionStatus status={connectionStatus} />
				</div>
			</div>
		);
	}

	return (
		<div style={{ width: "100%", height: "100%", position: "relative" }}>
			<App
				viewModel={viewModel}
				draftChoices={draftChoices}
				onPick={handlePick}
				onDeploy={handleDeploy}
				onReady={handleReady}
			/>
			<div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 5 }}>
				<ConnectionStatus status={connectionStatus} />
			</div>
		</div>
	);
}
