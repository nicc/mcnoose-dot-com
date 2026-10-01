// Dev-only tweak panel. Every key in CONFIG gets a control; "save" writes them to src/config.ts.
import GUI from 'lil-gui';
import type { Config } from '../config';
import type { Layout } from '../layout';

type Range = [min: number, max: number, step: number];

const RANGES: Partial<Record<keyof Config, Range>> = {
  TILE_MAX_PX: [120, 800, 1],
  GROUT_PX: [0, 24, 0.5],
  MIN_PEEK: [0, 0.5, 0.01],
  TRAILING_ROWS: [0, 15, 1],
  HEADER_HEIGHT: [0.25, 3, 0.05],
  WALLPAPER_ZOOM: [0.25, 4, 0.05],
  EMBROIDERY_WIDTH: [0.2, 1.4, 0.01],
  EMBROIDERY_TEXT_SIZE: [0.02, 0.3, 0.002],
  EMBROIDERY_STITCH_SIZE: [0.003, 0.05, 0.001],
  EMBROIDERY_FLORAL_SIZE: [0.02, 0.4, 0.005],
  EMBROIDERY_TILT_DEG: [-30, 30, 0.5],
  BULLNOSE_WIDTH: [0.5, 3, 0.05],
  BULLNOSE_HEIGHT: [0.1, 1, 0.01],
  BULLNOSE_OFFSET: [0, 1, 0.01],
  SKIRTING_HEIGHT: [0.1, 1.5, 0.01],
  TILE_LOGO_SIZE: [0.05, 0.8, 0.005],
  TILE_TITLE_SIZE: [0.02, 0.2, 0.002],
  TILE_TITLE_GAP: [0, 0.3, 0.005],
  TILE_TITLE_WEIGHT: [100, 900, 100],
  HALFTONE_PITCH_PX: [0.6, 8, 0.05],
  HALFTONE_ANGLE_DEG: [0, 90, 0.5],
  HALFTONE_GAIN: [0.5, 2, 0.01],
  HALFTONE_MIN_DOT: [0, 0.5, 0.01],
  HALFTONE_JITTER: [0, 0.5, 0.01],
  HALFTONE_NOISE: [0, 0.6, 0.01],
  HALFTONE_BLUR_PX: [0, 2, 0.05],
  HALFTONE_OPACITY: [0, 1, 0.01],
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
        ? v.startsWith('#')
          ? gui.addColor(values, key)
          : gui.add(values, key)
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
