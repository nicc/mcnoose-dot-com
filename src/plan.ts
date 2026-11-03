// Where the wall's parts stand on the page: pure geometry, no drawing. The scene builds from it, and
// so does the pencil drawing shown while the page loads (pencil/), which must land on the same lines.
import type { Config } from './config';
import { projectMargin, visibleColumns, wallRows, type Anchor } from './layout';
import { pxPerCm, roomFromConfig, viewAt } from './room';
import { wallPoint, type WallMap } from './tiles/surface';
import { railProfile, skirtingProfile, type Profile, type RailDims, type SkirtingDims } from './trim/profile';
import { embroiderySize, layoutSampler, SAMPLER_LINES } from './embroidery/chart';

export const railDims = (c: Config): RailDims => ({ depthCm: c.RAIL_DEPTH_CM, roundCm: c.RAIL_ROUND_CM, beadCm: c.RAIL_BEAD_CM, coveCm: c.RAIL_COVE_CM, flatCm: c.RAIL_FLAT_CM });
export const skirtingDims = (c: Config): SkirtingDims => ({ depthCm: c.SKIRTING_DEPTH_CM, torusCm: c.SKIRTING_TORUS_CM, reliefCm: c.SKIRTING_RELIEF_CM, flatCm: c.SKIRTING_FLAT_CM });
export const TILE_FACE_CM = 0.9; // tile faces stand this far off the wall

export const wallMap = (c: Config, a: Anchor, topExtra: number): WallMap => {
  const room = roomFromConfig(c);
  return { pxPerCm: pxPerCm(room, a.tile), embroidery: room.embroidery, embroideryPage: { x: a.centreX, y: topExtra + (c.HEADER_HEIGHT * a.tile) / 2 } };
};

// From eye height you look down onto a trim's top: the ledge from where its front rounds over back
// to whatever hides it (`behindCm` off the wall: the tile face, or the wall itself above the rail),
// foreshortened by the view angle. It's what a deep board's thickness looks like.
export function ledgeCm(c: Config, a: Anchor, topExtra: number, top: number, profile: Profile, behindCm: number): number {
  const view = viewAt(roomFromConfig(c), wallPoint(wallMap(c, a, topExtra), { x: a.centreX, y: top }));
  return (Math.max(0, profile.topDepthCm - behindCm) * Math.max(0, -view[1])) / view[2];
}
export const railTop = (c: Config, a: Anchor, topExtra: number) => topExtra + c.HEADER_HEIGHT * a.tile;
export const railLedgeCm = (c: Config, a: Anchor, topExtra: number) => ledgeCm(c, a, topExtra, railTop(c, a, topExtra), railProfile(railDims(c)), 0);
export const railHeight = (c: Config, a: Anchor, topExtra: number) => (railProfile(railDims(c)).heightCm + railLedgeCm(c, a, topExtra)) * (a.tile / c.ROOM_TILE_CM);
// The well-fitted joints where the tiles meet the rail and the skirting: a fine caulked line.
export const edgeJoint = (c: Config, tile: number) => c.GROUT_EDGE_CM * (tile / c.ROOM_TILE_CM);
export const firstTileTop = (c: Config, a: Anchor, topExtra: number) => railTop(c, a, topExtra) + railHeight(c, a, topExtra) + edgeJoint(c, a.tile);
export const skirtingTop = (c: Config, a: Anchor, topExtra: number, rows: number) => firstTileTop(c, a, topExtra) + rows * a.pitch - c.GROUT_PX + edgeJoint(c, a.tile);

// The framed sampler's size in CSS px, and its moulding's width.
export function frameSize(c: Config, tile: number): { width: number; height: number; moulding: number } {
  const chart = layoutSampler(SAMPLER_LINES, { w: c.EMBROIDERY_CLOTH_W, h: c.EMBROIDERY_CLOTH_H });
  const style = { stitch: c.EMBROIDERY_STITCH_SIZE * tile, frame: c.EMBROIDERY_FRAME * tile };
  const natural = embroiderySize(chart, style);
  return { width: natural.width * c.EMBROIDERY_ZOOM, height: natural.height * c.EMBROIDERY_ZOOM, moulding: style.frame * c.EMBROIDERY_ZOOM };
}

// The wall's outline as an elevation drawing would show it, in page px for a window `width` wide.
export interface WallPlan {
  frame: { x: number; y: number; width: number; height: number; moulding: number; tiltDeg: number }; // centred on x, y; as it hangs at load
  rail: number[]; // y of each of the rail's edges, top to bottom
  tiles: { top: number; rows: number; originX: number; tile: number; pitch: number };
  skirting: number[]; // y of each of its edges, down to the floor
}

export function wallPlan(c: Config, a: Anchor, topExtra: number, projects: number, width: number): WallPlan {
  const ppc = pxPerCm(roomFromConfig(c), a.tile);
  const f = frameSize(c, a.tile);
  const edges = (top: number, profile: Profile, ledge: number) => [top, ...(ledge > 0 ? [top + ledge * ppc] : []), ...profile.edgesCm.map((e) => top + (ledge + e) * ppc), top + (ledge + profile.heightCm) * ppc];
  const rows = wallRows(projects, a, visibleColumns(a, width, projectMargin(a, c.PROJECT_PEEK)).full.length, c.TRAILING_ROWS);
  const skirting = skirtingProfile(skirtingDims(c)), sTop = skirtingTop(c, a, topExtra, rows);
  return {
    frame: { x: a.centreX, y: topExtra + (c.HEADER_HEIGHT * a.tile) / 2, ...f, tiltDeg: c.EMBROIDERY_TILT_DEG },
    rail: edges(railTop(c, a, topExtra), railProfile(railDims(c)), railLedgeCm(c, a, topExtra)),
    tiles: { top: firstTileTop(c, a, topExtra), rows, originX: a.originX, tile: a.tile, pitch: a.pitch },
    skirting: edges(sTop, skirting, ledgeCm(c, a, topExtra, sTop, skirting, TILE_FACE_CM)),
  };
}
