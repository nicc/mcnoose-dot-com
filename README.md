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

Upload the contents of `dist/` (`index.html`, `projects.json`, `logos/`) to any static web host. It needs to be served over http(s); opening `index.html` from disk won't load the projects.

## Acknowledgements
- Claude
- Smithsonian: https://www.si.edu/object/sidewall:chndm_1939-45-7-a_b
