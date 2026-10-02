// Dev-only tweak panel. Every key in CONFIG gets a control; "save" writes them to src/config.ts.
import GUI from 'lil-gui';
import type { Config } from '../config';
import { groupOf, ORDER } from '../config-groups';
import type { Frame } from '../scene';

type Range = [min: number, max: number, step: number];

const RANGES: Partial<Record<keyof Config, Range>> = {
  TILE_MAX_PX: [120, 800, 1],
  ROOM_TILE_CM: [5, 40, 0.5],
  ROOM_WIDTH_CM: [100, 600, 1],
  ROOM_DEPTH_CM: [100, 800, 1],
  ROOM_CEILING_CM: [180, 400, 1],
  ROOM_EYE_CM: [80, 200, 1],
  ROOM_VIEW_CM: [30, 600, 1],
  ROOM_EMBROIDERY_X_CM: [0, 600, 1],
  ROOM_EMBROIDERY_Y_CM: [40, 220, 1],
  ROOM_WINDOW_X_CM: [0, 600, 1],
  ROOM_WINDOW_BOTTOM_CM: [0, 250, 1],
  ROOM_WINDOW_WIDTH_CM: [10, 300, 1],
  ROOM_WINDOW_HEIGHT_CM: [10, 250, 1],
  ROOM_SUN: [0, 3, 0.01],
  ROOM_CLOUD_DEPTH: [0, 1, 0.01],
  ROOM_CLOUD_RATE_HZ: [0.005, 1, 0.005],
  ROOM_CLOUD_SMOOTH: [0, 1, 0.01],
  ROOM_FILL: [0, 1.5, 0.01],
  ROOM_BOUNCE: [0, 1, 0.01],
  ROOM_EYE_FOLLOW: [0, 1, 0.01],
  GROUT_PX: [0, 24, 0.5],
  MIN_PEEK: [0, 0.5, 0.01],
  TILE_TONE: [0, 0.15, 0.001],
  TILE_EDGE_CM: [0, 1.5, 0.01],
  TILE_EDGE_SHEEN: [0, 1.5, 0.01],
  TILE_REFLECTION: [0, 1, 0.01],
  TILE_TILT_DEG: [0, 4, 0.05],
  TILE_WAVINESS: [0, 2, 0.01],
  TILE_CRAZING: [0, 1, 0.01],
  TILE_SPOTS: [0, 1, 0.01],
  TILE_SPOTS_LOW: [0, 1, 0.01],
  TILE_LIMESCALE: [0, 1, 0.01],
  TILE_GRIME_ROWS: [1, 12, 1],
  GROUT_AGE: [0, 1, 0.01],
  GROUT_GRIME: [0, 1, 0.01],
  GROUT_MOULD: [0, 1, 0.01],
  GROUT_LIMESCALE: [0, 1, 0.01],
  GROUT_EROSION: [0, 1, 0.01],
  GROUT_CRACKS: [0, 1, 0.01],
  GROUT_RECESS: [0, 1.5, 0.01],
  TRAILING_ROWS: [0, 15, 1],
  REFLOW_FADE_MS: [0, 1500, 10],
  PIN_SMOOTH_MS: [0, 300, 1],
  HEADER_HEIGHT: [0.25, 3, 0.05],
  WALLPAPER_ZOOM: [0.2, 6, 0.05],
  WALLPAPER_RELIEF: [0, 3, 0.01],
  WALLPAPER_PEBBLE_PX: [1, 10, 0.1],
  WALLPAPER_INK_RELIEF: [0, 1, 0.01],
  WALLPAPER_AMBIENT: [0, 1, 0.01],
  WALLPAPER_SHEEN: [0, 1, 0.01],
  EMBROIDERY_STITCH_SIZE: [0.004, 0.06, 0.0002],
  EMBROIDERY_ZOOM: [0.2, 3, 0.01],
  EMBROIDERY_CLOTH_W: [40, 140, 1],
  EMBROIDERY_CLOTH_H: [25, 110, 1],
  EMBROIDERY_FRAME: [0, 0.2, 0.002],
  EMBROIDERY_STANDOFF_CM: [0, 8, 0.1],
  EMBROIDERY_WOOD_RINGS: [0.001, 0.04, 0.0005],
  EMBROIDERY_WOOD_FIGURE: [0, 1, 0.01],
  EMBROIDERY_WOOD_PORES: [0, 1, 0.01],
  EMBROIDERY_WOOD_DRIFT: [0, 1, 0.01],
  EMBROIDERY_WOOD_VARIATION: [0, 0.6, 0.01],
  EMBROIDERY_WOOD_DEPTH: [0, 1.5, 0.01],
  EMBROIDERY_WOOD_SHEEN: [0, 1.5, 0.01],
  EMBROIDERY_WOOD_GLOSS: [0, 1, 0.01],
  EMBROIDERY_WOOD_WEAR: [0, 1, 0.01],
  EMBROIDERY_WOOD_GRIME: [0, 1, 0.01],
  EMBROIDERY_WOOD_PATCHES: [0, 1, 0.01],
  EMBROIDERY_GLASS_TINT: [0, 1, 0.01],
  EMBROIDERY_GLASS_REFLECTION: [0, 1, 0.01],
  EMBROIDERY_GLASS_SPOTS: [0, 1, 0.01],
  WATER_SPOT_SIZE: [0.001, 0.04, 0.0005],
  EMBROIDERY_TILT_DEG: [-30, 30, 0.5],
  SKIRTING_DEPTH_CM: [0.5, 5, 0.05],
  SKIRTING_TORUS_CM: [0.5, 6, 0.05],
  SKIRTING_RELIEF_CM: [0.05, 3, 0.05],
  SKIRTING_FLAT_CM: [2, 30, 0.1],
  SKIRTING_WEAR: [0, 1, 0.01],
  SKIRTING_GRIME: [0, 1, 0.01],
  SKIRTING_SCUFFS: [0, 1, 0.01],
  SKIRTING_SCUFF_LOW: [0, 1, 0.01],
  SKIRTING_DUST: [0, 2, 0.01],
  RAIL_DEPTH_CM: [0.5, 6, 0.05],
  RAIL_ROUND_CM: [0, 3, 0.05],
  RAIL_BEAD_CM: [0, 2, 0.05],
  RAIL_COVE_CM: [0, 3, 0.05],
  RAIL_FLAT_CM: [0, 12, 0.1],
  RAIL_WEAR: [0, 1, 0.01],
  RAIL_GRIME: [0, 1, 0.01],
  RAIL_DUST: [0, 1, 0.01],
  DUST_SHADE: [0, 1, 0.01],
  EMBROIDERY_DUST_TOP: [0, 2, 0.01],
  EMBROIDERY_DUST_INNER: [0, 2, 0.01],
  GROUT_EDGE_CM: [0, 0.5, 0.01],
  RAIL_SHADOW: [0, 1.5, 0.01],
  PAINT_GRAIN: [0, 1, 0.01],
  PAINT_BRUSH: [0, 1.5, 0.01],
  PAINT_BUILDUP: [0, 1.5, 0.01],
  PAINT_YELLOWING: [0, 1, 0.01],
  PAINT_SHEEN: [0, 1.5, 0.01],
  PAINT_GLOSS: [0, 1, 0.01],
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

export function mountPanel(state: Config, render: (force?: boolean) => Frame) {
  const gui = new GUI({ title: 'config', closeFolders: true });
  gui.close(); // starts collapsed; click the title to open
  const values = state as Record<string, number | string>;
  const readout = { tile: '', columns: 0, peek: '' }; // peek: left / right edge tiles, in tiles

  const update = (force = true) => {
    const l = render(force);
    readout.tile = `${l.tile.toFixed(1)}px`;
    readout.columns = l.columns;
    readout.peek = `${(l.peekLeft / l.tile).toFixed(2)} / ${(l.peekRight / l.tile).toFixed(2)}`;
  };

  // One folder per config section (src/config-groups.ts), in config.ts order, all starting closed.
  const folders = new Map<string, GUI>();
  for (const name of ORDER) folders.set(name, gui.addFolder(name));
  for (const key of Object.keys(values)) {
    const v = values[key];
    const folder = folders.get(groupOf(key))!;
    const c =
      typeof v === 'string'
        ? v.startsWith('#')
          ? folder.addColor(values, key)
          : folder.add(values, key)
        : folder.add(values, key, ...(RANGES[key as keyof Config] ?? [0, Math.max(1, v * 4), 0.01]));
    c.onChange(() => update());
  }
  for (const f of folders.values()) if (!f.controllers.length) f.destroy();

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
