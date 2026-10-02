// Rewrites `KEY: value,` lines in src/config.ts in place, keeping comments and layout.
import { readFileSync, writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export type Values = Record<string, number | string | boolean>;

const format = (v: number | string | boolean) =>
  typeof v === 'boolean' ? String(v) : typeof v === 'number' ? String(Number(v.toFixed(4))) : `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function rewriteConfig(source: string, values: Values): string {
  let out = source;
  for (const [key, value] of Object.entries(values)) {
    // Value is a quoted string (may contain commas) or a bare token.
    const re = new RegExp(`^(\\s*${key}:\\s*)('(?:[^'\\\\\\n]|\\\\.)*'|[^,\\n]+)(,)`, 'm');
    if (!re.test(out)) throw new Error(`config key not found: ${key}`);
    out = out.replace(re, (_, head: string, _old: string, tail: string) => head + format(value) + tail);
  }
  return out;
}

// Dev-server endpoint the tweak panel POSTs to.
export function configWriter(file = 'src/config.ts'): Plugin {
  return {
    name: 'config-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__config', (req, res) => {
        if (req.method !== 'POST') return void res.writeHead(405).end();
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            writeFileSync(file, rewriteConfig(readFileSync(file, 'utf8'), JSON.parse(body)));
            res.writeHead(204).end();
          } catch (e) {
            res.writeHead(400).end(String(e));
          }
        });
      });
    },
  };
}
