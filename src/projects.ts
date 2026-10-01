import raw from './projects.json';

export interface Project {
  title: string;
  url: string;
  logo: string; // filename in src/logos/
  logoUrl: string;
}

// Inlined as data URIs in the single-file build.
const logos = import.meta.glob<string>('./logos/*', { eager: true, query: '?url', import: 'default' });

export function validate(entries: unknown, logoNames: string[]): string[] {
  if (!Array.isArray(entries)) return ['projects.json must be an array'];
  const errors: string[] = [];
  entries.forEach((p, i) => {
    for (const key of ['title', 'url', 'logo'] as const) {
      if (typeof p?.[key] !== 'string' || !p[key]) errors.push(`#${i}: missing ${key}`);
    }
    if (typeof p?.logo === 'string' && !logoNames.includes(p.logo)) errors.push(`#${i}: no src/logos/${p.logo}`);
  });
  return errors;
}

export function loadProjects(): Project[] {
  return raw.map((p) => ({ ...p, logoUrl: logos[`./logos/${p.logo}`] ?? '' }));
}
