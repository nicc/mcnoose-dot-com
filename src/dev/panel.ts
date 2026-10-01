// Dev-only tweak panel. Every key in CONFIG gets a control; "save" writes them to src/config.ts.
import GUI from 'lil-gui';
import type { Config } from '../config';
import type { Layout } from '../layout';

type Range = [min: number, max: number, step: number];

const RANGES: Partial<Record<keyof Config, Range>> = {
  TILE_MAX: [120, 800, 1],
  GROUT: [0, 24, 0.5],
  MIN_PEEK: [0, 0.5, 0.01],
  TRAILING_ROWS: [0, 15, 1],
  HEADER_HEIGHT_TILES: [0.25, 3, 0.05],
  WALLPAPER_ZOOM: [0.25, 4, 0.05],
  FRAME_WIDTH_TILES: [0.2, 1.4, 0.01],
  STITCH_TEXT_TILES: [0.02, 0.3, 0.002],
  STITCH_SIZE_TILES: [0.003, 0.05, 0.001],
  ACCENT_SIZE_TILES: [0.02, 0.4, 0.005],
  FRAME_TILT_DEG: [-30, 30, 0.5],
  BULLNOSE_WIDTH_RATIO: [0.5, 3, 0.05],
  BULLNOSE_HEIGHT_RATIO: [0.1, 1, 0.01],
  BULLNOSE_OFFSET: [0, 1, 0.01],
  SKIRTING_HEIGHT_TILES: [0.1, 1.5, 0.01],
};

export function mountPanel(state: Config, render: (force?: boolean) => Layout) {
  const gui = new GUI({ title: 'config' });
  const values = state as Record<string, number | string>;
  const readout = { tile: '', columns: 0, peek: '' };

  const update = (force = true) => {
    const l = render(force);
    readout.tile = `${l.tile.toFixed(1)}px`;
    readout.columns = l.columns;
    readout.peek = `${(l.peek / l.tile).toFixed(2)} tile`;
  };

  for (const key of Object.keys(values)) {
    const v = values[key];
    const c =
      typeof v === 'string'
        ? gui.addColor(values, key)
        : gui.add(values, key, ...(RANGES[key as keyof Config] ?? [0, Math.max(1, v * 4), 0.01]));
    c.onChange(() => update());
  }

  const out = gui.addFolder('layout (read-only)');
  for (const k of Object.keys(readout)) out.add(readout, k as keyof typeof readout).disable().listen();

  const actions = {
    save: async () => {
      const res = await fetch('/__config', { method: 'POST', body: JSON.stringify(state) });
      gui.title(res.ok ? 'config — saved' : `config — save failed: ${await res.text()}`);
    },
  };
  gui.add(actions, 'save');
  gui.onChange((e) => e.property !== 'save' && gui.title('config — unsaved'));
  addEventListener('resize', () => update(false));
  update();
}
