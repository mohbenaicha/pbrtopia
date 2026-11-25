// normal-reauthor R4, R9: the three parameters, their ranges and the fixed tangent table. No DOM, no store.

export interface ReauthorParams {
  slopeDeg: number; // integer 5..80
  seamRadius: number; // 0..16 step 0.5, texels at 1024
  seamFlatten: number; // integer percent 0..100
}

export const SLOPE_DEG_MIN = 5;
export const SLOPE_DEG_MAX = 80;
export const SEAM_RADIUS_MAX = 16;
export const SEAM_RADIUS_STEP = 0.5;
export const SEAM_FLATTEN_MAX = 100;

export const DEFAULT_PARAMS: ReauthorParams = { slopeDeg: 45, seamRadius: 4, seamFlatten: 100 }; // a new generation (R17)
export const ADOPTED_PARAMS: ReauthorParams = { slopeDeg: 45, seamRadius: 4, seamFlatten: 0 }; // an older picture (R16)

export const FILL_REACH_AT_1024 = 16; // R8: texels, scaled by side / 1024
export const PANEL_MAX_SIDE = 2048; // R2 row 7

// tan(5 degrees) to tan(80 degrees) as literals, so main thread and worker (and every engine) read the same numbers (R9); tan(45) is exactly 1
const TAN_TABLE: readonly number[] = [
  0.08748866352592401, 0.10510423526567646, 0.1227845609029046, 0.14054083470239145,
  0.15838444032453627, 0.17632698070846498, 0.19438030913771848, 0.2125565616700221,
  0.23086819112556312, 0.24932800284318068, 0.2679491924311227, 0.2867453857588079,
  0.3057306814586604, 0.3249196962329063, 0.3443276132896652, 0.36397023426620234,
  0.3838640350354158, 0.4040262258351568, 0.4244748162096047, 0.4452286853085361,
  0.4663076581549986, 0.48773258856586144, 0.5095254494944288, 0.5317094316614788,
  0.554309051452769, 0.5773502691896257, 0.6008606190275604, 0.6248693519093275,
  0.6494075931975106, 0.6745085168424267, 0.7002075382097097, 0.7265425280053608,
  0.7535540501027942, 0.7812856265067173, 0.809784033195007, 0.8390996311772799,
  0.8692867378162265, 0.9004040442978399, 0.9325150861376615, 0.9656887748070739,
  1, 1.0355303137905694, 1.0723687100246826, 1.1106125148291928,
  1.1503684072210094, 1.19175359259421, 1.234897156535051, 1.2799416321930788,
  1.3270448216204098, 1.3763819204711734, 1.4281480067421144, 1.4825609685127403,
  1.5398649638145825, 1.6003345290410504, 1.6642794823505174, 1.7320508075688767,
  1.8040477552714236, 1.8807264653463318, 1.9626105055051504, 2.050303841579296,
  2.1445069205095586, 2.2460367739042164, 2.355852365823752, 2.4750868534162964,
  2.6050890646938005, 2.7474774194546216, 2.904210877675822, 3.0776835371752527,
  3.2708526184841404, 3.4874144438409087, 3.7320508075688776, 4.010780933535842,
  4.331475874284157, 4.704630109478451, 5.144554015970307, 5.671281819617707,
];

export const isSameParams = (a: ReauthorParams, b: ReauthorParams): boolean => a.slopeDeg === b.slopeDeg && a.seamRadius === b.seamRadius && a.seamFlatten === b.seamFlatten;

/** tan(slopeDeg) / tan(45): the factor of R5. slopeDeg is an integer in range. */
export function slopeFactor(slopeDeg: number): number {
  return TAN_TABLE[slopeDeg - SLOPE_DEG_MIN]!;
}

/** The radius of R6 in texels of a picture of this side. */
export function seamRadiusTexels(seamRadius: number, side: number): number {
  return (seamRadius * side) / 1024;
}

/** The reach of R8 in texels of a picture of this side. */
export function fillReachTexels(side: number): number {
  return Math.ceil((FILL_REACH_AT_1024 * side) / 1024);
}
