import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import raw from '../public/projects.json';
import fixtures from './dev/fixtures/fixtures.json';
import { parseProjects, validate } from './projects';

describe('projects.json', () => {
  it('is valid and every logo exists', () => {
    expect(validate(raw, readdirSync(new URL('../public/logos', import.meta.url)))).toEqual([]);
  });

  it('dev fixtures are valid too', () => {
    expect(validate(fixtures, readdirSync(new URL('./dev/fixtures/logos', import.meta.url)))).toEqual([]);
  });

  it('reports missing fields and logos', () => {
    expect(validate([{ title: 'x', url: '', logo: 'nope.svg' }], [])).toEqual(['#0: missing url', '#0: no logos/nope.svg']);
  });

  it('keeps good entries, skips bad ones, and points logos next to the page', () => {
    const quiet = console.warn;
    console.warn = () => {};
    const parsed = parseProjects([{ title: 'A', url: 'https://a', logo: 'a.svg' }, { title: 'B' }]);
    console.warn = quiet;
    expect(parsed).toEqual([{ title: 'A', url: 'https://a', logo: 'a.svg', logoUrl: 'logos/a.svg' }]);
  });
});
