// "Swap day": any template day — from the active program or any other — can
// stand in for the day that's scheduled. Templates are served by the
// prerendered /templates.json and fetched on demand.
import type { Program, ProgramDay } from './content/types';
import { resolvePlan } from './today';

export type TemplateProgram = Pick<Program, 'id' | 'title' | 'status' | 'progression' | 'days'>;

export interface TemplatePick {
	program: TemplateProgram;
	day: ProgramDay;
}

let cached: Promise<TemplateProgram[]> | null = null;

/** All programs' day templates, active program first (the loader's order). */
export function loadTemplates(): Promise<TemplateProgram[]> {
	if (!cached) {
		cached = fetch('/templates.json')
			.then((r) => {
				if (!r.ok) throw new Error(`templates: ${r.status}`);
				return r.json() as Promise<TemplateProgram[]>;
			})
			.catch((e) => {
				cached = null; // let a later attempt retry (e.g. back online)
				throw e;
			});
	}
	return cached;
}

/** A picked template's rows for the week in hand. Progression values only
 *  apply when the template comes from the program the week number belongs to
 *  — another program's week 7 means nothing against today's date. */
export function resolvePick(pick: TemplatePick, activeId: string | undefined, week: number | null): ProgramDay {
	return resolvePlan(pick.day, pick.program, pick.program.id === activeId ? week : null);
}
