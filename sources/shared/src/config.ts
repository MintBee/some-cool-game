export const LANE_COUNT = 7;
export const STARTING_HP = 30;
export const TROPHIES_TO_WIN = 10;
export const DECK_SIZE = 9;
export const FRONTIER_SIZE = 3;
export const SHADOW_SIZE = 3;
export const BATTLE_PREP_SIZE = 1;
export const DRAFT_CHOICES = 3;
export const PREP_TIMER_MS = 30_000;
export const BATTLE_PREP_TIMER_MS = 15_000;
export const CARD_POOL_SIZE = 22;

/** Building phase: picks per round boundary */
export const BUILDING_PICKS: Record<number, number> = {
	0: 3, // game start: 3 picks → deck = 3
	1: 2, // after R1: 2 picks → deck = 5
	2: 2, // after R2: 2 picks → deck = 7
	3: 2, // after R3: 2 picks → deck = 9
};

/** Deploy limits per round */
export const DEPLOY_LIMITS: Record<
	number,
	{ frontier: number; shadow: number; battlePrep: number }
> = {
	1: { frontier: 3, shadow: 0, battlePrep: 0 },
	2: { frontier: 3, shadow: 2, battlePrep: 0 },
	3: { frontier: 3, shadow: 3, battlePrep: 1 },
};

/** Default deploy limits for R4+ */
export const DEFAULT_DEPLOY_LIMITS = { frontier: 3, shadow: 3, battlePrep: 1 };

export function getDeployLimits(round: number) {
	return DEPLOY_LIMITS[round] ?? DEFAULT_DEPLOY_LIMITS;
}
