import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Trailing slash off: /route, /route/m-upper-acc — clean trail-sign labels.
		alias: {
			$content: 'src/lib/content'
		}
	}
};

export default config;
