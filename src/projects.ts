// Projects live next to the page, not in the build: public/projects.json and public/logos/ are
// copied beside index.html, so adding a project is editing those files on the server — no rebuild.
// Fetched on each load (revalidated, so edits show up); bad entries are skipped with a warning.

export interface Project {
  title: string;
  url: string;
  logo: string; // filename in logos/
  logoUrl: string;
}

// Problems with the entries; logo files are checked only when their names are known (the repo test).
export function validate(entries: unknown, logoNames?: string[]): string[] {
  if (!Array.isArray(entries)) return ['projects.json must be an array'];
  return entries.flatMap((p, i) => entryErrors(p, i, logoNames));
}

function entryErrors(p: Record<string, unknown> | undefined, i: number, logoNames?: string[]): string[] {
  const errors: string[] = [];
  for (const key of ['title', 'url', 'logo'] as const) {
    if (typeof p?.[key] !== 'string' || !p[key]) errors.push(`#${i}: missing ${key}`);
  }
  if (logoNames && typeof p?.logo === 'string' && !logoNames.includes(p.logo)) errors.push(`#${i}: no logos/${p.logo}`);
  return errors;
}

export function parseProjects(entries: unknown): Project[] {
  if (!Array.isArray(entries)) {
    console.warn('projects.json must be an array');
    return [];
  }
  return entries.flatMap((p, i) => {
    const errors = entryErrors(p, i);
    if (errors.length) {
      console.warn(`projects.json: skipping ${errors.join(', ')}`);
      return [];
    }
    return [{ title: p.title, url: p.url, logo: p.logo, logoUrl: `logos/${p.logo}` }];
  });
}

export async function loadProjects(): Promise<Project[]> {
  try {
    const res = await fetch('projects.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseProjects(await res.json());
  } catch (e) {
    console.error('projects.json could not be loaded:', e);
    return [];
  }
}
