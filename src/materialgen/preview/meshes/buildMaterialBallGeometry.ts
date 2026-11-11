import type { BufferGeometry } from 'three';
import { addRevolvedStrip, createMeshArrays, toBufferGeometry, type ProfileRow } from './revolveProfile';

const SEGMENTS = 128; // steps about the axis
const SPACING = 0.012; // about the distance between rings along the profile, fine enough for a height map to show as displacement
const TURN_STEP = Math.PI / 12; // the most the normal turns between two rings on a curve

const BASE_RADIUS = 0.5;
const BASE_BOTTOM = -0.5;
const BASE_TOP = -0.31;
const BEVEL = 0.02; // radius of the rounded edges of the base
const GUTTER_OUTER = 0.43; // radius where the gutter starts, going in
const GUTTER_INNER = 0.25;
const GUTTER_DEPTH = 0.05;

const BALL_CENTRE = 0.04; // height of the centre of both shells
const OUTER_RADIUS = 0.42;
const INNER_RADIUS = 0.31;
const OPENING = (50 * Math.PI) / 180; // the opening's half angle, from the top

const row = (r: number, y: number, nr: number, ny: number): ProfileRow => ({ r: r < 1e-9 ? 0 : r, y, nr, ny, v: 0 });

/** A straight run of the profile from (r0, y0) to (r1, y1) with one normal. */
function lineRows(r0: number, y0: number, r1: number, y1: number, nr: number, ny: number): ProfileRow[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / SPACING));
  return Array.from({ length: steps + 1 }, (_, i) => row(r0 + ((r1 - r0) * i) / steps, y0 + ((y1 - y0) * i) / steps, nr, ny));
}

/** The arc of a circle with centre (centreR, centreY), `from` to `to` measured from straight up; `facing` is 1 for an outward normal and -1 for an inward one. */
function arcRows(centreR: number, centreY: number, radius: number, from: number, to: number, facing: 1 | -1): ProfileRow[] {
  const steps = Math.max(Math.ceil(Math.abs(to - from) / TURN_STEP), Math.ceil((radius * Math.abs(to - from)) / SPACING));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = from + ((to - from) * i) / steps;
    return row(centreR + radius * Math.sin(angle), centreY + radius * Math.cos(angle), facing * Math.sin(angle), facing * Math.cos(angle));
  });
}

/** The round lip that joins the outer shell's edge to the inner shell's edge over the top of the opening. */
function lipRows(): ProfileRow[] {
  const middle = (OUTER_RADIUS + INNER_RADIUS) / 2;
  const radius = (OUTER_RADIUS - INNER_RADIUS) / 2;
  const out = [Math.sin(OPENING), Math.cos(OPENING)];
  const up = [-Math.cos(OPENING), Math.sin(OPENING)];
  const steps = Math.ceil(Math.PI / TURN_STEP);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const turn = (Math.PI * i) / steps;
    const nr = Math.cos(turn) * out[0]! + Math.sin(turn) * up[0]!;
    const ny = Math.cos(turn) * out[1]! + Math.sin(turn) * up[1]!;
    return row(middle * out[0]! + radius * nr, BALL_CENTRE + middle * out[1]! + radius * ny, nr, ny);
  });
}

/** The gutter: the height falls from the top's level to GUTTER_DEPTH below it and back as one cosine, so it is smooth at both ends and round at the bottom. */
function gutterRows(): ProfileRow[] {
  const width = GUTTER_OUTER - GUTTER_INNER;
  const steps = Math.ceil(width / (SPACING / 2));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const slope = (GUTTER_DEPTH * Math.PI * Math.sin(2 * Math.PI * t)) / width; // dy/dr: the height rises with the radius on the way down into the gutter
    const length = Math.hypot(slope, 1);
    return row(GUTTER_OUTER - width * t, BASE_TOP - (GUTTER_DEPTH * (1 - Math.cos(2 * Math.PI * t))) / 2, -slope / length, 1 / length);
  });
}

/** Joins runs end to start (the shared ring is kept once) and sets v along the whole profile, 0 to 1. */
function joinProfile(runs: readonly ProfileRow[][]): ProfileRow[] {
  const rows = runs.flatMap((run, index) => (index === 0 ? run : run.slice(1)));
  const lengths = [0];
  for (let i = 1; i < rows.length; i += 1) lengths.push(lengths[i - 1]! + Math.hypot(rows[i]!.r - rows[i - 1]!.r, rows[i]!.y - rows[i - 1]!.y));
  const total = lengths[lengths.length - 1]!;
  return rows.map((entry, i) => ({ ...entry, v: lengths[i]! / total }));
}

/** The base, from the axis under it to the axis on top: the underside, the rounded foot, the wall, the rounded rim, the flat ring, the gutter and the flat centre. */
function baseProfile(): ProfileRow[] {
  const inner = BASE_RADIUS - BEVEL;
  return joinProfile([
    lineRows(0, BASE_BOTTOM, inner, BASE_BOTTOM, 0, -1),
    arcRows(inner, BASE_BOTTOM + BEVEL, BEVEL, Math.PI, Math.PI / 2, 1),
    lineRows(BASE_RADIUS, BASE_BOTTOM + BEVEL, BASE_RADIUS, BASE_TOP - BEVEL, 1, 0),
    arcRows(inner, BASE_TOP - BEVEL, BEVEL, Math.PI / 2, 0, 1),
    lineRows(inner, BASE_TOP, GUTTER_OUTER, BASE_TOP, 0, 1),
    gutterRows(),
    lineRows(GUTTER_INNER, BASE_TOP, 0, BASE_TOP, 0, 1),
  ]);
}

/** The ball, from the axis at the bottom of the outer shell (buried in the base) up the outside, over the lip and down the inside to the axis at the bottom of the cavity. */
function ballProfile(): ProfileRow[] {
  return joinProfile([
    arcRows(0, BALL_CENTRE, OUTER_RADIUS, Math.PI, OPENING, 1),
    lipRows(),
    arcRows(0, BALL_CENTRE, INNER_RADIUS, OPENING, Math.PI, -1),
  ]);
}

/**
 * Preview R57: the Material ball: a hollow ball of two shells joined by a lip at an opening on top, resting in a round base with a gutter. Two surfaces of revolution, each one
 * smooth strip (no hard edge, so displacement cannot tear it) and closed on the axis at both ends. It is textured by position in the shaders, not by its UVs. The mesh is fixed
 * (about 35 000 vertices); unlike the Ball and the Plane the resolution level does not subdivide it.
 */
export function buildMaterialBallGeometry(): BufferGeometry {
  const mesh = createMeshArrays();
  addRevolvedStrip(mesh, baseProfile(), SEGMENTS);
  addRevolvedStrip(mesh, ballProfile(), SEGMENTS);
  return toBufferGeometry(mesh);
}
