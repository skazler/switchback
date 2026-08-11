// Parsing + display for the two free-text numeric fields on the session
// screen: ride/interval duration and ride distance. Both are typed on a phone
// mid-workout, so entry is lenient (a two-hour ride is "2:00", "2h", or "120")
// while storage stays canonical — seconds for duration, decimal miles for
// distance.

/** Round to `places` decimals and drop trailing zeros ("12.50" → "12.5"). */
const trim = (n: number, places: number) => String(Number(n.toFixed(places)));

/**
 * Duration input → seconds, or null if it isn't a duration.
 *
 * Accepts h:mm and h:mm:ss ("1:30", "1:05:30"), unit-suffixed forms
 * ("90m", "1h30", "1h30m", "1.5h"), and a bare number, which means minutes
 * ("90", "22.5") — the format this field only ever took before.
 */
export function parseDuration(input: string): number | null {
	const s = input.trim().toLowerCase().replace(/\s+/g, '');
	if (!s) return null;

	// h:mm[:ss] — each part a plain integer, no unit suffixes.
	const colon = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
	if (colon) {
		const [h, m, sec] = [Number(colon[1]), Number(colon[2]), Number(colon[3] ?? 0)];
		return h * 3600 + m * 60 + sec;
	}

	// 1h30m / 1h30 / 1.5h / 90m / 45s, in any combination.
	const unit = s.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m(?:in)?)?(?:(\d+(?:\.\d+)?)s)?$/);
	if (unit && (unit[1] || unit[2] || unit[3])) {
		const [h, m, sec] = [Number(unit[1] ?? 0), Number(unit[2] ?? 0), Number(unit[3] ?? 0)];
		return Math.round(h * 3600 + m * 60 + sec);
	}
	// "1h30" — hours then bare minutes, which the pattern above can't take.
	const hm = s.match(/^(\d+(?:\.\d+)?)h(\d{1,2})$/);
	if (hm) return Math.round(Number(hm[1]) * 3600 + Number(hm[2]) * 60);

	// Bare number: minutes.
	const bare = s.match(/^\d+(?:\.\d+)?$/);
	if (bare) return Math.round(Number(s) * 60);

	return null;
}

/** Seconds → compact display: "45m", "1h", "1h30m". Seconds round to minutes. */
export function formatDuration(seconds: number): string {
	const total = Math.max(0, Math.round(seconds / 60));
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (!h) return `${m}m`;
	return m ? `${h}h${m}m` : `${h}h`;
}

/** Seconds → what goes back into the input on prefill ("45", "1:30"). */
export function durationInputValue(seconds: number): string {
	const total = Math.max(0, Math.round(seconds / 60));
	const h = Math.floor(total / 60);
	if (!h) return String(total);
	return `${h}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Distance input → decimal miles, or null if it isn't a distance. Tolerates a
 * trailing unit ("12.4mi") and a comma decimal mark ("12,4").
 */
export function parseDistance(input: string): number | null {
	const s = input.trim().toLowerCase().replace(/\s+/g, '').replace(/(?:mi|mile|miles)$/, '').replace(',', '.');
	if (!s || !/^\d*\.?\d+$/.test(s)) return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}

/** Miles → display, keeping up to two decimals ("12.4", "12.45", "12"). */
export function formatDistance(miles: number): string {
	return trim(miles, 2);
}
