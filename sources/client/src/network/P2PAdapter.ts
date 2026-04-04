import type { Action, GameMessage } from "@game/shared";
import type { INetworkAdapter } from "./interface.js";

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export class P2PAdapter implements INetworkAdapter {
	isHost = false;

	private ws: WebSocket | null = null;
	private pc: RTCPeerConnection | null = null;
	private gameChannel: RTCDataChannel | null = null;
	private playerId = "";
	private roomId = "";
	private hostId = "";
	private peers: string[] = [];

	/** Public so HostEngine can deliver messages to the host's own callbacks */
	messageCallbacks: ((msg: GameMessage) => void)[] = [];
	private statusCallbacks: ((
		status: "connecting" | "connected" | "relay" | "disconnected",
	) => void)[] = [];
	private matchStartedCallbacks: ((data: {
		matchId: string;
		players: string[];
		hostId: string;
	}) => void)[] = [];
	private peerCountCallbacks: ((count: number, capacity: number) => void)[] = [];
	private pendingMessages: string[] = [];

	async connect(serverUrl: string, roomId: string, playerId: string): Promise<void> {
		this.playerId = playerId;
		this.roomId = roomId;

		return new Promise((resolve, reject) => {
			this.emitStatus("connecting");

			this.ws = new WebSocket(serverUrl);

			this.ws.onopen = () => {
				this.ws?.send(
					JSON.stringify({
						type: "joinRoom",
						roomId,
						playerId,
					}),
				);
			};

			this.ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				this.handleSignalingMessage(msg, resolve);
			};

			this.ws.onerror = () => {
				this.emitStatus("disconnected");
				reject(new Error("WebSocket connection failed"));
			};

			this.ws.onclose = () => {
				this.emitStatus("disconnected");
			};
		});
	}

	private async handleSignalingMessage(
		msg: Record<string, unknown>,
		onConnected?: (value: undefined) => void,
	): Promise<void> {
		switch (msg.type) {
			case "roomJoined":
				this.peers = msg.players as string[];
				for (const cb of this.peerCountCallbacks) {
					cb(this.peers.length, (msg.capacity as number) || 2);
				}
				onConnected?.(undefined);
				break;

			case "peerJoined":
				this.peers.push(msg.playerId as string);
				for (const cb of this.peerCountCallbacks) {
					cb(this.peers.length, (msg.capacity as number) || 2);
				}
				break;

			case "matchStarted": {
				this.hostId = msg.hostId as string;
				this.isHost = this.hostId === this.playerId;
				this.peers = msg.players as string[];

				for (const cb of this.matchStartedCallbacks) {
					cb({
						matchId: msg.matchId as string,
						players: this.peers,
						hostId: this.hostId,
					});
				}

				// Initiate WebRTC connection
				await this.setupPeerConnection();

				if (this.isHost) {
					// Host creates the offer
					const targetId = this.peers.find((p) => p !== this.playerId);
					if (targetId) await this.createOffer(targetId);
				}
				break;
			}

			case "sdpOffer": {
				if (!this.pc) await this.setupPeerConnection();
				const offer = new RTCSessionDescription({
					type: "offer",
					sdp: msg.sdp as string,
				});
				await this.pc?.setRemoteDescription(offer);
				const answer = await this.pc?.createAnswer();
				await this.pc?.setLocalDescription(answer);
				this.ws?.send(
					JSON.stringify({
						type: "sdpAnswer",
						target: msg.from as string,
						sdp: answer.sdp,
					}),
				);
				break;
			}

			case "sdpAnswer": {
				const answer = new RTCSessionDescription({
					type: "answer",
					sdp: msg.sdp as string,
				});
				await this.pc?.setRemoteDescription(answer);
				break;
			}

			case "iceCandidate": {
				if (msg.candidate) {
					await this.pc?.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
				}
				break;
			}

			case "error":
				console.error("Signaling error:", msg.message);
				break;
		}
	}

	private async setupPeerConnection(): Promise<void> {
		this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

		this.pc.onicecandidate = (event) => {
			if (event.candidate) {
				const targetId = this.peers.find((p) => p !== this.playerId);
				if (targetId) {
					this.ws?.send(
						JSON.stringify({
							type: "iceCandidate",
							target: targetId,
							candidate: event.candidate.toJSON(),
						}),
					);
				}
			}
		};

		this.pc.ondatachannel = (event) => {
			if (event.channel.label === "game") {
				this.gameChannel = event.channel;
				this.setupGameChannel();
			}
		};

		this.pc.onconnectionstatechange = () => {
			if (this.pc?.connectionState === "connected") {
				this.emitStatus("connected");
			} else if (
				this.pc?.connectionState === "disconnected" ||
				this.pc?.connectionState === "failed"
			) {
				this.emitStatus("disconnected");
			}
		};
	}

	private async createOffer(targetId: string): Promise<void> {
		// Host creates the data channel
		this.gameChannel = this.pc?.createDataChannel("game", { ordered: true });
		this.setupGameChannel();

		const offer = await this.pc?.createOffer();
		await this.pc?.setLocalDescription(offer);

		this.ws?.send(
			JSON.stringify({
				type: "sdpOffer",
				target: targetId,
				sdp: offer.sdp,
			}),
		);
	}

	private setupGameChannel(): void {
		if (!this.gameChannel) return;

		this.gameChannel.onopen = () => {
			this.emitStatus("connected");
			// Flush any messages queued before channel was open
			for (const queued of this.pendingMessages) {
				this.gameChannel?.send(queued);
			}
			this.pendingMessages = [];
		};

		this.gameChannel.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data) as GameMessage;
				for (const cb of this.messageCallbacks) cb(msg);
			} catch {
				console.error("Failed to parse game message");
			}
		};

		this.gameChannel.onclose = () => {
			this.emitStatus("disconnected");
		};
	}

	sendAction(action: Action): void {
		const data = JSON.stringify(action);
		if (this.gameChannel?.readyState === "open") {
			this.gameChannel.send(data);
		} else {
			this.pendingMessages.push(data);
		}
	}

	/** Send a game message (used by HostEngine to push state to peers) */
	sendMessage(message: GameMessage): void {
		const data = JSON.stringify(message);
		if (this.gameChannel?.readyState === "open") {
			this.gameChannel.send(data);
		} else {
			this.pendingMessages.push(data);
		}
	}

	onMessage(callback: (message: GameMessage) => void): void {
		this.messageCallbacks.push(callback);
	}

	onStatusChange(
		callback: (status: "connecting" | "connected" | "relay" | "disconnected") => void,
	): void {
		this.statusCallbacks.push(callback);
	}

	onMatchStarted(
		callback: (data: { matchId: string; players: string[]; hostId: string }) => void,
	): void {
		this.matchStartedCallbacks.push(callback);
	}

	onPeerCount(callback: (count: number, capacity: number) => void): void {
		this.peerCountCallbacks.push(callback);
	}

	disconnect(): void {
		this.gameChannel?.close();
		this.pc?.close();
		this.ws?.close();
		this.gameChannel = null;
		this.pc = null;
		this.ws = null;
		this.emitStatus("disconnected");
	}

	private emitStatus(status: "connecting" | "connected" | "relay" | "disconnected"): void {
		for (const cb of this.statusCallbacks) cb(status);
	}
}
