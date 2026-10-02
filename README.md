# Snickers McNoose

## About

## Development

```sh
npm install
npm run dev
```

## Adding a project

Edit `projects.json` (next to `index.html` on the server; `public/projects.json` in the repo) and drop the logo into `logos/` beside it. No rebuild needed.

```json
{ "title": "My Project", "url": "https://example.com", "logo": "my-project.svg" }
```

Logos are SVG or PNG on the same site. Darker, more opaque areas print more ink.

## The about note

Click the embroidery to turn it over. The note on the back is `about.md` (next to `index.html` on the server; `public/about.md` in the repo). Blank lines start paragraphs, line breaks are kept, `# ` makes a heading, `- ` a list, `[text](https://…)` a link. It shrinks to fit the paper, so keep it short.

## Configuration

## Testing

```sh
npm test
npm run test:e2e
npm run shots
```

## Build

```sh
npm run build
```

## Deployment

```sh
npm run build
```

Upload the contents of `dist/` (`index.html`, `projects.json`, `logos/`, `about.md`) to any static web host. It needs to be served over http(s); opening `index.html` from disk won't load the projects.

## Acknowledgements
- Claude
- Smithsonian: https://www.si.edu/object/sidewall:chndm_1939-45-7-a_b
