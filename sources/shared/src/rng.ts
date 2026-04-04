/**
 * Seeded PRNG using mulberry32 algorithm.
 * Deterministic: same seed always produces same sequence.
 */
export function createRng(seed: number): () => number {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Shuffle an array in place using Fisher-Yates with provided RNG */
export function shuffle<T>(array: T[], rng: () => number): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

/** Pick n random items from an array without replacement */
export function pickRandom<T>(array: T[], count: number, rng: () => number): T[] {
	const copy = [...array];
	shuffle(copy, rng);
	return copy.slice(0, count);
}
