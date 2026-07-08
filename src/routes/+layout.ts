// Everything renders from the repo at build time — prerender the whole site.
// Server routes (/api/*) opt back into runtime where needed.
export const prerender = true;
export const trailingSlash = 'never';
