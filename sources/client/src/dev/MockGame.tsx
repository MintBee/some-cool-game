import {
	CARD_CATALOG,
	Phase,
	Tier,
	advancePhase,
	applyAction,
	createCard,
	createInitialGameState,
	resolveBattle,
} from "@game/shared";
import { useState } from "preact/hooks";
import { App } from "../components/App.js";
import { type BoardViewModel, type CardView, deriveViewModel } from "../state/ViewModel.js";

const ALICE = "alice";
const BOB = "bob";

function buildDeck(cardIds: string[], tier: Tier = Tier.T1) {
	return cardIds.map((id) => createCard(CARD_CATALOG[id], tier));
}

export function MockGame() {
	const [state, setState] = useState(() => {
		// Create a round 1 game with pre-built decks
		let s = createInitialGameState(ALICE, BOB, 1);

		const aliceDeck = buildDeck(["slash", "barrier", "meteor"]);
		const bobDeck = buildDeck(["pierce", "reflect", "sabotage"]);

		s = {
			...s,
			phase: Phase.Prep,
			players: [
				{ ...s.players[0], deck: aliceDeck, reserve: [...aliceDeck] },
				{ ...s.players[1], deck: bobDeck, reserve: [...bobDeck] },
			],
		};

		return s;
	});

	const [viewModel, setViewModel] = useState<BoardViewModel>(() => deriveViewModel(state, ALICE));

	const updateState = (newState: typeof state) => {
		setState(newState);
		setViewModel(deriveViewModel(newState, ALICE));
	};

	const handleDeploy = (cardId: string) => {
		const player = state.players[0];
		const nextSlot = player.deployed.findIndex((c) => c === null);
		if (nextSlot === -1) return;

		try {
			const s = applyAction(state, {
				type: "deployCard",
				playerId: ALICE,
				cardId,
				slot: nextSlot,
			});
			updateState(s);
		} catch (e) {
			console.error("Deploy failed:", e);
		}
	};

	const handleAutoDeployBob = () => {
		let s = state;
		const bob = s.players[1];
		for (let i = 0; i < bob.reserve.length; i++) {
			const card = bob.reserve[i];
			const nextSlot = s.players[1].deployed.findIndex((c) => c === null);
			if (nextSlot === -1) break;
			try {
				s = applyAction(s, {
					type: "deployCard",
					playerId: BOB,
					cardId: card.id,
					slot: nextSlot,
				});
			} catch {
				break;
			}
		}
		updateState(s);
	};

	const handleReady = () => {
		let s = applyAction(state, { type: "ready", playerId: ALICE });
		s = applyAction(s, { type: "ready", playerId: BOB });
		updateState(s);
	};

	const handleBattle = () => {
		let s = state;
		// Advance through phases to battle
		while (s.phase !== Phase.Battle) {
			s = advancePhase(s);
		}
		s = resolveBattle(s);
		s = advancePhase(s); // to Result

		// Award trophy based on HP comparison
		const hpA = s.players[0].hp;
		const hpB = s.players[1].hp;
		if (hpA > hpB) {
			s = {
				...s,
				players: [{ ...s.players[0], trophies: s.players[0].trophies + 1 }, s.players[1]],
			};
		} else if (hpB > hpA) {
			s = {
				...s,
				players: [s.players[0], { ...s.players[1], trophies: s.players[1].trophies + 1 }],
			};
		}
		// Equal HP or double KO: no trophy

		updateState(s);
	};

	const handleNextRound = () => {
		const nextRound = state.round + 1;
		let s = createInitialGameState(ALICE, BOB, nextRound);

		// Build new decks for the next round (more cards in later rounds)
		const aliceCards =
			nextRound >= 3
				? ["slash", "barrier", "meteor", "pierce", "reflect", "sabotage", "drain"]
				: nextRound >= 2
					? ["slash", "barrier", "meteor", "pierce", "reflect"]
					: ["slash", "barrier", "meteor"];
		const bobCards =
			nextRound >= 3
				? ["pierce", "reflect", "sabotage", "slash", "barrier", "meteor", "drain"]
				: nextRound >= 2
					? ["pierce", "reflect", "sabotage", "slash", "barrier"]
					: ["pierce", "reflect", "sabotage"];

		const aliceDeck = buildDeck(aliceCards);
		const bobDeck = buildDeck(bobCards);

		s = {
			...s,
			phase: Phase.Prep,
			players: [
				{
					...s.players[0],
					deck: aliceDeck,
					reserve: [...aliceDeck],
					hp: state.players[0].hp,
					trophies: state.players[0].trophies,
				},
				{
					...s.players[1],
					deck: bobDeck,
					reserve: [...bobDeck],
					hp: state.players[1].hp,
					trophies: state.players[1].trophies,
				},
			],
		};

		updateState(s);
	};

	return (
		<div style={{ width: "100%", height: "100%", position: "relative" }}>
			<App viewModel={viewModel} onDeploy={handleDeploy} onReady={handleReady} />

			{/* Dev controls */}
			<div
				style={{
					position: "absolute",
					bottom: "8px",
					right: "8px",
					display: "flex",
					gap: "8px",
					zIndex: 10,
				}}
			>
				<DevButton onClick={handleAutoDeployBob} label="Auto-Deploy Bob" />
				<DevButton onClick={handleBattle} label="Run Battle" />
				{state.phase === Phase.Result && <DevButton onClick={handleNextRound} label="Next Round" />}
				<DevButton
					onClick={() => updateState(createInitialGameState(ALICE, BOB, 1))}
					label="Reset"
				/>
			</div>

			{/* State debug */}
			<div
				style={{
					position: "absolute",
					top: "8px",
					right: "220px",
					fontSize: "11px",
					color: "#555",
					zIndex: 5,
				}}
			>
				Phase: {state.phase} | Round: {state.round} | HP: {state.players[0].hp}/
				{state.players[1].hp} | Deployed: {state.players[0].deployed.filter(Boolean).length}/
				{state.players[1].deployed.filter(Boolean).length}
			</div>
		</div>
	);
}

function DevButton({ onClick, label }: { onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				padding: "6px 12px",
				background: "#333",
				color: "#e0e0e0",
				border: "1px solid #555",
				borderRadius: "4px",
				cursor: "pointer",
				fontSize: "11px",
			}}
		>
			{label}
		</button>
	);
}
