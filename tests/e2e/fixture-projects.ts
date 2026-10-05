// A fixed set of projects for tests whose subject is layout, not the real list: the dev fixtures
// (src/dev/fixtures), served in place of the site's projects.json and logos.
import type { Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = new URL('../../src/dev/fixtures/', import.meta.url);
export const fixtureProjects: { title: string; url: string; logo: string }[] = JSON.parse(readFileSync(new URL('fixtures.json', DIR), 'utf8'));

export async function serveFixtures(page: Page): Promise<void> {
  await page.route('**/projects.json', (route) => route.fulfill({ json: fixtureProjects }));
  await page.route('**/logos/*', (route) => {
    const file = fileURLToPath(new URL(`logos/${new URL(route.request().url()).pathname.split('/').pop()}`, DIR));
    return existsSync(file) ? route.fulfill({ path: file }) : route.continue();
  });
}
