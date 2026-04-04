import {
	type Action,
	BATTLE_PREP_TIMER_MS,
	CARD_CATALOG,
	type Card,
	DRAFT_CHOICES,
	type GameMessage,
	type GameState,
	PREP_TIMER_MS,
	Phase,
	Tier,
	advancePhase,
	applyAction,
	applyBattleResult,
	createCard,
	createInitialGameState,
	createMatch,
	filterStateForPlayer,
	generateDraftChoices,
	getCurrentPairing,
	getDraftPickCount,
	getEconomyPhase,
	isPhaseComplete,
	lockMatch,
	resolveBattle,
	startBattle,
	validateAction,
} from "@game/shared";
import { createRng } from "@game/shared";
import type { P2PAdapter } from "./P2PAdapter.js";

/**
 * Runs on the host peer only.
 * Wraps the shared engine, validates actions, sends filtered state to peers.
 */
export class HostEngine {
	private matchState;
	private gameState: GameState | null = null;
	private round = 1;
	private rng: () => number;
	private adapter: P2PAdapter;
	private hostId: string;
	private pendingDrafts: Map<string, string[][]> = new Map();
	private playerDecks: Map<string, Card[]> = new Map();
	private onStateChange: (state: GameState) => void;
	private phaseTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		adapter: P2PAdapter,
		players: string[],
		matchId: string,
		hostId: string,
		onStateChange: (state: GameState) => void,
	) {
		this.adapter = adapter;
		this.hostId = hostId;
		this.onStateChange = onStateChange;
		this.rng = createRng(Date.now());

		this.matchState = lockMatch(createMatch(matchId, players));

		// Listen for incoming actions from non-host peer
		const actionTypes = new Set([
			"pickCard",
			"deployCard",
			"insertBattlePrep",
			"discardCard",
			"upgradeCard",
			"ready",
		]);
		adapter.onMessage((msg: GameMessage) => {
			if (actionTypes.has(msg.type)) {
				this.handleIncomingAction(msg as unknown as Action);
			}
		});

		// Handle peer disconnection
		adapter.onStatusChange((status) => {
			if (status === "disconnected") {
				this.clearPhaseTimer();
			}
		});

		this.startNewRound();
	}

	private startNewRound(): void {
		const [playerA, playerB] = getCurrentPairing(this.matchState);

		// Preserve decks from previous rounds (draft picks accumulate per player)
		const deckA = this.playerDecks.get(playerA) ?? [];
		const deckB = this.playerDecks.get(playerB) ?? [];
		const existingDecks: [Card[], Card[]] | undefined =
			deckA.length > 0 || deckB.length > 0 ? [deckA, deckB] : undefined;

		const trophies: [number, number] = [
			this.matchState.wins[playerA] ?? 0,
			this.matchState.wins[playerB] ?? 0,
		];
		this.gameState = createInitialGameState(playerA, playerB, this.round, existingDecks, trophies);

		// Start building phase — generate draft choices
		this.runBuildingPhase();
	}

	private runBuildingPhase(): void {
		if (!this.gameState) return;

		const econ = getEconomyPhase(this.round);

		if (econ === "building") {
			const pickCount = getDraftPickCount(this.round === 1 ? 0 : this.round);
			for (const player of this.gameState.players) {
				const choices = generateDraftChoices(pickCount, this.rng);
				this.pendingDrafts.set(player.id, choices);

				// Send first set of draft choices
				if (choices.length > 0) {
					const cardChoices = choices[0].map((id) => createCard(CARD_CATALOG[id], Tier.T1));
					this.sendToPlayer(player.id, {
						type: "draftChoices",
						choices: cardChoices,
					});
				}
			}
			// Broadcast initial state so the UI can render the game board
			this.broadcastState();
		} else if (econ === "replacement") {
			// Players need to discard first, then pick
			this.advanceToPrep();
		} else {
			// Reinforcement — players must upgrade
			this.advanceToPrep();
		}
	}

	private advanceToPrep(): void {
		if (!this.gameState) return;
		this.gameState = advancePhase(this.gameState);
		this.startPhaseTimer();
		this.broadcastState();
	}

	private startPhaseTimer(): void {
		this.clearPhaseTimer();
		if (!this.gameState) return;

		const timerEnd = this.gameState.timers.phaseEnd;
		if (timerEnd <= 0) return;

		const remaining = timerEnd - Date.now();
		if (remaining <= 0) return;

		this.phaseTimer = setTimeout(() => {
			if (!this.gameState) return;
			// Auto-ready any players who haven't readied
			for (const player of this.gameState.players) {
				if (!player.ready) {
					this.gameState = applyAction(this.gameState, {
						type: "ready",
						playerId: player.id,
					});
				}
			}
			if (isPhaseComplete(this.gameState)) {
				this.handlePhaseComplete();
			}
			this.broadcastState();
		}, remaining);
	}

	private clearPhaseTimer(): void {
		if (this.phaseTimer) {
			clearTimeout(this.phaseTimer);
			this.phaseTimer = null;
		}
	}

	handleIncomingAction(action: Action): void {
		if (!this.gameState) return;

		// Validate pick against the player's offered draft choices
		if (action.type === "pickCard") {
			const drafts = this.pendingDrafts.get(action.playerId);
			if (!drafts || drafts.length === 0) {
				console.warn(`Invalid pick from ${action.playerId}: No pending draft choices`);
				return;
			}
			const currentChoices = drafts[0];
			if (!currentChoices.includes(action.cardId)) {
				console.warn(`Invalid pick from ${action.playerId}: Card ${action.cardId} not in offered choices`);
				return;
			}
		}

		const validation = validateAction(this.gameState, action);
		if (!validation.valid) {
			console.warn(`Invalid action from ${action.playerId}: ${validation.reason}`);
			return;
		}

		this.gameState = applyAction(this.gameState, action);

		if (action.type === "pickCard") {
			this.handlePickComplete(action.playerId);
		}

		// Check if phase should advance
		if (isPhaseComplete(this.gameState)) {
			this.handlePhaseComplete();
		}

		this.broadcastState();
	}

	private handlePickComplete(playerId: string): void {
		const drafts = this.pendingDrafts.get(playerId);
		if (!drafts || drafts.length === 0) return;

		// Remove the used draft set
		drafts.shift();

		// Send next draft choices if any remain
		if (drafts.length > 0) {
			const cardChoices = drafts[0].map((id) => createCard(CARD_CATALOG[id], Tier.T1));
			this.sendToPlayer(playerId, {
				type: "draftChoices",
				choices: cardChoices,
			});
		} else {
			this.pendingDrafts.delete(playerId);

			// If all players done drafting, advance
			if (this.pendingDrafts.size === 0) {
				this.advanceToPrep();
			}
		}
	}

	private handlePhaseComplete(): void {
		if (!this.gameState) return;

		switch (this.gameState.phase) {
			case Phase.Prep:
				this.gameState = advancePhase(this.gameState); // → Matching
				this.gameState = advancePhase(this.gameState); // → BattlePrep or Battle
				if (this.gameState.phase === Phase.Battle) {
					this.runBattle(); // R1/R2 skip BattlePrep, go straight to Battle
				}
				break;

			case Phase.BattlePrep:
				this.gameState = advancePhase(this.gameState); // → Battle
				this.runBattle();
				break;

			case Phase.Building:
				// Handled by draft completion
				break;

			case Phase.Battle:
				this.gameState = advancePhase(this.gameState); // → Result
				this.handleBattleResult();
				break;

			default:
				this.gameState = advancePhase(this.gameState);
		}

		this.broadcastState();
	}

	private async runBattle(): Promise<void> {
		if (!this.gameState) return;

		this.gameState = resolveBattle(this.gameState);

		// Send lane reveals one at a time
		for (const lane of this.gameState.lanes) {
			if (lane.result && lane.cardA && lane.cardB) {
				const cardA = this.gameState.players[0].deployed.find((c) => c?.id === lane.cardA);
				const cardB = this.gameState.players[1].deployed.find((c) => c?.id === lane.cardB);

				if (cardA && cardB) {
					const msg: GameMessage = {
						type: "laneReveal",
						lane: lane.index,
						cardA,
						cardB,
						result: lane.result,
					};

					this.broadcastMessage(msg);

					// Delay between reveals for animation pacing
					await new Promise((resolve) => setTimeout(resolve, 800));
				}
			}
		}

		// After all reveals, advance to Result
		this.gameState = advancePhase(this.gameState);
		this.handleBattleResult();
	}

	private handleBattleResult(): void {
		if (!this.gameState) return;

		const [playerA, playerB] = [this.gameState.players[0], this.gameState.players[1]];

		// Persist decks for next round
		this.playerDecks.set(playerA.id, playerA.deck);
		this.playerDecks.set(playerB.id, playerB.deck);

		// Update match state first so trophy counts include this round's result
		this.matchState = applyBattleResult(this.matchState, {
			hpA: playerA.hp,
			hpB: playerB.hp,
			playerAId: playerA.id,
			playerBId: playerB.id,
		});

		// Send battle result with updated trophy counts
		const resultMsg: GameMessage = {
			type: "battleResult",
			winner: playerA.hp > playerB.hp ? playerA.id : playerB.hp > playerA.hp ? playerB.id : null,
			hpA: playerA.hp,
			hpB: playerB.hp,
			trophies: [this.matchState.wins[playerA.id] ?? 0, this.matchState.wins[playerB.id] ?? 0],
		};
		this.broadcastMessage(resultMsg);

		if (!this.matchState.matchOver) {
			this.round++;
			// Start next round after a delay
			setTimeout(() => this.startNewRound(), 2000);
		}
	}

	private broadcastState(): void {
		if (!this.gameState) return;

		// Send filtered state to each player
		for (const player of this.gameState.players) {
			const visible = filterStateForPlayer(this.gameState, player.id);
			this.sendToPlayer(player.id, {
				type: "stateSync",
				state: visible as unknown as GameState,
			});
		}

		// Notify the host's own UI
		this.onStateChange(this.gameState);
	}

	private sendToPlayer(playerId: string, message: GameMessage): void {
		if (playerId === this.hostId) {
			// Deliver to host's own message listeners
			for (const cb of this.adapter.messageCallbacks) {
				cb(message);
			}
		} else {
			this.adapter.sendMessage(message);
		}
	}

	private broadcastMessage(message: GameMessage): void {
		for (const player of this.matchState.players) {
			this.sendToPlayer(player, message);
		}
	}
}
