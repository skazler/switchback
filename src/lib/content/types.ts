// Typed content model. Authored substrate lives in the repo:
//   exercises.yaml  — atoms      (the library, 536 tagged moves)
//   blocks/*.md     — molecules  (reusable literal or menu chunks)
//   programs/*.md   — compositions (one file per program)

/** Ski-trail difficulty marker — intensity encoding (DESIGN.md). */
export type Intensity = 'green' | 'blue' | 'black' | 'double-black';

export interface Exercise {
	id: string;
	name: string;
	category?: string;
	group?: string;
	subgroup?: string;
	note?: string;
	urls?: string[];
	equipment?: string[];
	modifiers?: string[];
}

export interface Block {
	id: string;
	title: string;
	/** prehab-menu · choice-menu · conditioning-menu · conditioning-block */
	type?: string;
	/** how the block is written where it appears in a program table */
	appearsAs?: string;
	rule?: string;
	/** rendered HTML of the block body (below front matter) */
	bodyHtml: string;
}

/** Resolution of a program-table name → a library entry or a block. */
export type ResolvedRef =
	| { kind: 'exercise'; id: string; name: string; url?: string }
	| { kind: 'block'; id: string; title: string }
	| null;

export interface SessionRow {
	/** first-column grouping label, e.g. "P/rehab", "Lifts" (may be blank) */
	group?: string;
	/** exercise/block name exactly as written in the table */
	name: string;
	ref: ResolvedRef;
	sets?: string;
	reps?: string;
	rest?: string;
	notes?: string;
	marker?: Intensity;
}

export interface ProgramDay {
	/** url slug, e.g. "m-upper-acc" (unique within a program) */
	slug: string;
	/** weekday code as authored: M · T · Tu · W · Th · F · Sa · Su */
	code: string;
	/** JS getDay() index: Sun=0 … Sat=6 */
	weekday: number;
	/** heading label, e.g. "upper acc" */
	label: string;
	rows: SessionRow[];
	/** day difficulty badge — max of row markers */
	marker: Intensity;
}

export interface Phase {
	label: string; // base · build · peak · deload
	/** inclusive week range, 1-based */
	weeks: [number, number];
	/** relative load height for the elevation profile (arbitrary units) */
	load: number;
	/** optional: mark the summit (race/test) week */
	summit?: boolean;
}

export interface Program {
	id: string;
	title: string;
	status: 'active' | 'archived';
	/** weekly = days bound to weekdays (today-resolution applies);
	 *  rotation = ordered slots you cycle through (no weekday binding) */
	schedule: 'weekly' | 'rotation';
	/** what the plan is for — used to group the library of plans, e.g.
	 *  "Firefighter S&C", "Hypertrophy + conditioning", "Snowboard base" */
	purpose?: string;
	/** relative demand / experience level, e.g. "base", "build", "peak",
	 *  "intro", "advanced" — used as a facet on /routes */
	level?: string;
	/** lineage slug grouping versions of the SAME plan as it evolves over
	 *  time. Programs sharing a series are ordered by `start` (newest first). */
	series?: string;
	/** ISO date, a Monday — enables week numbering (FLOWS §1) and version order */
	start?: string;
	source?: string;
	phases?: Phase[];
	/** rendered HTML of the prose above the first day section */
	overviewHtml: string;
	/** per-week breakdown parsed from an overview table headed "Week" (e.g.
	 *  the Saturday long-ride duration) — resolves rows whose prescription is
	 *  "see progression" instead of a fixed sets/reps (FLOWS §3). */
	progression?: ProgressionWeek[];
	days: ProgramDay[];
}

export interface ProgressionWeek {
	week: number;
	/** every non-"Week" column, in table order, as authored */
	columns: { label: string; value: string }[];
}

/** A name that appeared in a program table but resolved to nothing. */
export interface UnresolvedName {
	name: string;
	program: string;
	day: string;
}

/** The whole compiled corpus + build diagnostics. */
export interface Content {
	exercises: Exercise[];
	blocks: Block[];
	programs: Program[];
	warnings: string[];
	unresolved: UnresolvedName[];
}
