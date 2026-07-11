// See https://svelte.dev/docs/kit/types#app.d.ts
/// <reference types="@cloudflare/workers-types" />
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** set by hooks when a valid owner session cookie is present */
			owner: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				DB?: D1Database; // runtime store (logs, credentials) — M3
				BOOTSTRAP_TOKEN?: string; // gates passkey registration (Workers secret)
			};
			cf?: CfProperties;
			ctx?: ExecutionContext;
		}
	}
}

export {};
