// The pencil drawing shown while the page loads (src/pencil/boot.ts) runs before the main bundle has
// downloaded, so it can't be part of it: built on its own and inlined into index.html as a classic
// script at the top of the body, which runs as soon as the HTML has arrived. In dev, a module script
// ahead of main.ts.
import { build, type Plugin } from 'vite';

const ENTRY = 'src/pencil/boot.ts';

export function pencilInline(): Plugin {
  let serve = false;
  return {
    name: 'pencil-inline',
    configResolved(config) {
      serve = config.command === 'serve';
    },
    async transformIndexHtml() {
      if (serve) return [{ tag: 'script', attrs: { type: 'module', src: `/${ENTRY}` }, injectTo: 'body-prepend' }];
      const out = await build({
        configFile: false,
        publicDir: false,
        logLevel: 'warn',
        build: { write: false, minify: true, lib: { entry: ENTRY, formats: ['iife'], name: 'pencil' } },
      });
      const code = (Array.isArray(out) ? out[0] : out) as { output: { code?: string }[] };
      return [{ tag: 'script', children: code.output[0].code!.replaceAll('</script', '<\\/script'), injectTo: 'body-prepend' }];
    },
  };
}
