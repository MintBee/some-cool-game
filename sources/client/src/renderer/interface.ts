import type { BoardViewModel, CardView, LaneView } from "../state/ViewModel.js";

export interface IRenderAdapter {
	/** Mount the renderer into a DOM container */
	mount(container: HTMLElement): void;

	/** Re-render the board from the current ViewModel snapshot */
	updateBoard(viewModel: BoardViewModel): void;

	/** Animate a card being deployed to a slot */
	playDeploy(slot: number, card: CardView): Promise<void>;

	/** Animate a lane reveal (flip + resolution) */
	playLaneReveal(lane: LaneView): Promise<void>;

	/** Tear down the renderer and clean up resources */
	destroy(): void;
}
