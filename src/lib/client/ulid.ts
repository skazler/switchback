// Monotonic ULID — lexicographically sortable, client-generated ids for
// sessions/sets (FLOWS §5/§6). 48-bit ms timestamp + 80-bit randomness,
// Crockford base32. Same-ms calls increment the random field for order.
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = 0;
let lastRand: number[] = [];

function randChars(n: number): number[] {
	const bytes = crypto.getRandomValues(new Uint8Array(n));
	return Array.from(bytes, (b) => b % 32);
}

function encodeTime(ms: number): string {
	let out = '';
	for (let i = 9; i >= 0; i--) {
		out = ENC[ms % 32] + out;
		ms = Math.floor(ms / 32);
	}
	return out;
}

export function ulid(now = Date.now()): string {
	if (now === lastTime) {
		// bump the random field (little-endian carry) for monotonic same-ms ids
		for (let i = lastRand.length - 1; i >= 0; i--) {
			if (lastRand[i] < 31) {
				lastRand[i]++;
				break;
			}
			lastRand[i] = 0;
		}
	} else {
		lastTime = now;
		lastRand = randChars(16);
	}
	return encodeTime(now) + lastRand.map((r) => ENC[r]).join('');
}
