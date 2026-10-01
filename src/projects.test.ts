import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixtures from './dev/fixtures/fixtures.json';
import raw from './projects.json';
import { validate } from './projects';

describe('projects.json', () => {
  it('is valid and every logo exists', () => {
    const logos = readdirSync(new URL('./logos', import.meta.url));
    expect(validate(raw, logos)).toEqual([]);
  });

  it('dev fixtures are valid too', () => {
    expect(validate(fixtures, readdirSync(new URL('./dev/fixtures/logos', import.meta.url)))).toEqual([]);
  });

  it('reports missing fields and logos', () => {
    expect(validate([{ title: 'x', url: '', logo: 'nope.svg' }], [])).toEqual([
      '#0: missing url',
      '#0: no src/logos/nope.svg',
    ]);
  });
});
