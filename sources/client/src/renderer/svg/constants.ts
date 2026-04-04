export const BOARD_WIDTH = 1400;
export const BOARD_HEIGHT = 700;
export const LANE_COUNT = 7;
export const CARD_WIDTH = 140;
export const CARD_HEIGHT = 180;
export const LANE_GAP = 16;
export const LANE_START_X = (BOARD_WIDTH - LANE_COUNT * (CARD_WIDTH + LANE_GAP) + LANE_GAP) / 2;
export const OPPONENT_Y = 40;
export const PLAYER_Y = BOARD_HEIGHT - CARD_HEIGHT - 40;
export const CENTER_Y = BOARD_HEIGHT / 2 - CARD_HEIGHT / 2;

export const TYPE_COLORS: Record<string, string> = {
	Disrupt: "#8b5cf6",
	Shield: "#3b82f6",
	Buff: "#22c55e",
	Strike: "#ef4444",
	Nuke: "#f59e0b",
};

export const SVG_NS = "http://www.w3.org/2000/svg";
