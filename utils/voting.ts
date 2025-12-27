/**
 * Finds the most frequent string in an array.
 * If there's a tie, it prefers the one with the most numeric characters (heuristic for score/digits).
 * If still a tie, returns the first one.
 */
export const findConsensus = (candidates: string[]): string => {
    if (!candidates || candidates.length === 0) return '';

    const frequency: { [key: string]: number } = {};
    let maxFreq = 0;

    // 1. Count frequencies
    candidates.forEach((c) => {
        // Normalize slightly (trim)
        const normalized = c.trim();
        if (!normalized) return;

        frequency[normalized] = (frequency[normalized] || 0) + 1;
        if (frequency[normalized] > maxFreq) {
            maxFreq = frequency[normalized];
        }
    });

    // 2. Filter candidates that match max frequency
    const topCandidates = Object.keys(frequency).filter(key => frequency[key] === maxFreq);

    if (topCandidates.length === 0) return '';
    if (topCandidates.length === 1) return topCandidates[0];

    // 3. Tie-breaking: pick the one with most digits (assuming we want a score)
    // e.g. "10,000" (5 digits) vs "10,  " (2 digits)
    return topCandidates.reduce((a, b) => {
        const digitsA = (a.match(/\d/g) || []).length;
        const digitsB = (b.match(/\d/g) || []).length;
        return digitsA >= digitsB ? a : b;
    });
};
