// Dev-only test logos spanning solid shapes to sub-pitch detail. Load with ?fixtures.
import type { Project } from '../../projects';
import raw from './fixtures.json';

const logos = import.meta.glob<string>('./logos/*', { eager: true, query: '?url', import: 'default' });

export const fixtureProjects = (): Project[] => raw.map((p) => ({ ...p, logoUrl: logos[`./logos/${p.logo}`] ?? '' }));
