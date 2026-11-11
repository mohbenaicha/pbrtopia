import type { BufferGeometry } from 'three';
import { addRevolvedStrip, createMeshArrays, toBufferGeometry, type ProfileRow, type UvRepeats } from './revolveProfile';

const SEGMENTS = 128; // steps about the axis
const REPEATS_AROUND = 3; // a whole number, so the seam column at the back reads the texel the first column reads
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
const RIM_ROUNDING = 0.01; // radius of the two rounded corners of the mouth's flat rim

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

/**
 * The mouth's rim: a flat run along the cone of the opening (its generators leave the ball's centre along `out`, its normal is `up`) with a small rounded corner at each end, where
 * it meets the outer shell and the inner shell. A fillet of radius RIM_ROUNDING sits RIM_ROUNDING below the rim and tangent to the shell, so the normal never jumps.
 */
function rimRows(): { outerAngle: number; innerAngle: number; rows: ProfileRow[] } {
  const out = [Math.sin(OPENING), Math.cos(OPENING)];
  const up = [-Math.cos(OPENING), Math.sin(OPENING)];
  const along = (reach: number): number[] => [reach * out[0]!, BALL_CENTRE + reach * out[1]!]; // a point of the rim, `reach` from the ball's centre
  const corner = (shell: number): { reach: number; angle: number; centre: number[] } => {
    const reach = Math.sqrt(shell * shell - RIM_ROUNDING * RIM_ROUNDING); // from the ball's centre to the point of the rim where the fillet ends
    const start = along(reach);
    return { reach, angle: OPENING + Math.atan(RIM_ROUNDING / reach), centre: [start[0]! - RIM_ROUNDING * up[0]!, start[1]! - RIM_ROUNDING * up[1]!] };
  };
  const outer = corner(OUTER_RADIUS - RIM_ROUNDING);
  const inner = corner(INNER_RADIUS + RIM_ROUNDING);
  const [outerFrom, innerTo] = [along(outer.reach), along(inner.reach)];
  const upAngle = OPENING - Math.PI / 2; // the rim's normal measured from straight up
  return {
    outerAngle: outer.angle,
    innerAngle: inner.angle,
    rows: [
      ...arcRows(outer.centre[0]!, outer.centre[1]!, RIM_ROUNDING, outer.angle, upAngle, 1),
      ...lineRows(outerFrom[0]!, outerFrom[1]!, innerTo[0]!, innerTo[1]!, up[0]!, up[1]!).slice(1, -1),
      ...arcRows(inner.centre[0]!, inner.centre[1]!, RIM_ROUNDING, upAngle, inner.angle - Math.PI, 1),
    ],
  };
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

/** Joins runs end to start (the shared ring is kept once) and sets v to the distance along the whole profile from its first ring. */
function joinProfile(runs: readonly ProfileRow[][]): ProfileRow[] {
  const rows = runs.flatMap((run, index) => (index === 0 ? run : run.slice(1)));
  const lengths = [0];
  for (let i = 1; i < rows.length; i += 1) lengths.push(lengths[i - 1]! + Math.hypot(rows[i]!.r - rows[i - 1]!.r, rows[i]!.y - rows[i - 1]!.y));
  return rows.map((entry, i) => ({ ...entry, v: lengths[i]! }));
}

/** Three repeats round the widest ring of a surface of the given radius, and the same length of texture per unit along the profile, so a repeat is square there. */
const repeatsFor = (widestRadius: number): UvRepeats => ({ around: REPEATS_AROUND, along: REPEATS_AROUND / (2 * Math.PI * widestRadius) });

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

/** The ball, from the axis at the bottom of the outer shell (buried in the base) up the outside, over the rim and down the inside to the axis at the bottom of the cavity. */
function ballProfile(): ProfileRow[] {
  const rim = rimRows();
  return joinProfile([
    arcRows(0, BALL_CENTRE, OUTER_RADIUS, Math.PI, rim.outerAngle, 1),
    rim.rows,
    arcRows(0, BALL_CENTRE, INNER_RADIUS, rim.innerAngle, Math.PI, -1),
  ]);
}

/**
 * Preview R57: the Material ball: a hollow ball of two shells joined by a flat rim at an opening on top, resting in a round base with a gutter. Two surfaces of revolution, each one
 * smooth strip (no hard edge, so displacement cannot tear it) and closed on the axis at both ends. Each surface is one UV chart: u 0 to 3 once round it, v the distance along its
 * profile, so the texture runs on without a blend; the seam at the back reads one texel on both sides, and the texture pinches only at the poles (under the base, buried in it, and
 * the cavity's bottom). The mesh is fixed (about 35 000 vertices); unlike the Ball and the Plane the resolution level does not subdivide it.
 */
export function buildMaterialBallGeometry(): BufferGeometry {
  const mesh = createMeshArrays();
  addRevolvedStrip(mesh, baseProfile(), SEGMENTS, repeatsFor(BASE_RADIUS));
  addRevolvedStrip(mesh, ballProfile(), SEGMENTS, repeatsFor(OUTER_RADIUS));
  return toBufferGeometry(mesh);
}
