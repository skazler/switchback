// Site-wide configuration. Single-tenant by design.

export const site = {
	title: 'Switchback',
	owner: 'Sky',
	timezone: 'America/Chicago',

	/**
	 * When true, guests see the owner's session history at /log.
	 * Regardless of this flag, per-set / per-session NOTES are never
	 * rendered to guests (see FLOWS §2). Default true.
	 */
	publicLogs: true
} as const;

export type SiteConfig = typeof site;
