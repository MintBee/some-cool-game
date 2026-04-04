import { useEffect, useRef, useState } from "preact/hooks";
import { SvgRenderer } from "../renderer/svg/SvgRenderer.js";
import type { BoardViewModel } from "../state/ViewModel.js";
import type { CardView } from "../state/ViewModel.js";
import { DraftPanel } from "./DraftPanel.js";
import { HandPanel } from "./HandPanel.js";
import { HpBar } from "./HpBar.js";
import { PhaseIndicator } from "./PhaseIndicator.js";
import { TrophyCounter } from "./TrophyCounter.js";

interface AppProps {
	viewModel: BoardViewModel;
	draftChoices?: CardView[];
	onPick?: (cardId: string) => void;
	onDeploy?: (cardId: string) => void;
	onReady?: () => void;
}

export function App({ viewModel, draftChoices, onPick, onDeploy, onReady }: AppProps) {
	const boardRef = useRef<HTMLDivElement>(null);
	const rendererRef = useRef<SvgRenderer | null>(null);

	useEffect(() => {
		if (boardRef.current && !rendererRef.current) {
			const renderer = new SvgRenderer();
			renderer.mount(boardRef.current);
			rendererRef.current = renderer;
		}
		return () => {
			rendererRef.current?.destroy();
			rendererRef.current = null;
		};
	}, []);

	useEffect(() => {
		rendererRef.current?.updateBoard(viewModel);
	}, [viewModel]);

	const showDraft = draftChoices && draftChoices.length > 0;
	const showHand =
		(viewModel.phase === "Prep" || viewModel.phase === "BattlePrep") &&
		viewModel.myReserve.length > 0;

	return (
		<div style={{ width: "100%", height: "100%", position: "relative" }}>
			{/* HUD overlay */}
			<div
				style={{
					position: "absolute",
					top: "8px",
					left: "8px",
					zIndex: 5,
					width: "200px",
				}}
			>
				<PhaseIndicator phase={viewModel.phase} round={viewModel.round} />
				<div style={{ marginTop: "8px" }}>
					<HpBar hp={viewModel.myHp} label="You" color="#22c55e" />
					<HpBar hp={viewModel.opponentHp} label="Opponent" color="#ef4444" />
				</div>
				<TrophyCounter
					myTrophies={viewModel.myTrophies}
					opponentTrophies={viewModel.opponentTrophies}
				/>
			</div>

			{/* Ready button */}
			{onReady && (viewModel.phase === "Prep" || viewModel.phase === "BattlePrep") && (
				<button
					type="button"
					onClick={onReady}
					style={{
						position: "absolute",
						top: "8px",
						right: "8px",
						zIndex: 5,
						padding: "8px 24px",
						background: "#22c55e",
						color: "#000",
						border: "none",
						borderRadius: "6px",
						fontWeight: "bold",
						cursor: "pointer",
						fontSize: "14px",
					}}
				>
					Ready
				</button>
			)}

			{/* SVG board */}
			<div ref={boardRef} style={{ width: "100%", height: "100%" }} />

			{/* Draft panel */}
			{showDraft && onPick && draftChoices && <DraftPanel choices={draftChoices} onPick={onPick} />}

			{/* Hand panel for deployment */}
			{showHand && onDeploy && <HandPanel cards={viewModel.myReserve} onDeploy={onDeploy} />}
		</div>
	);
}
