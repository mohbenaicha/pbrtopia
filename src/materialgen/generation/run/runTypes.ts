import type { GenerateRequest, GeneratedImage, ProviderError, Result } from '@shared/generation';
import type { Provider } from '@shared/keys';
import type { GeneratedMap, PixelImage } from '@mat/maps';
import type { PackedLayout } from '../layout/chooseLayout';
import type { GenerationPlan, PlanMap, SheetSettings } from '../plan/planTypes';

/** One provider call of a run: a map image, or the decomposition image. */
export interface ImageJob {
  id: string; // 'image-1' .. 'image-3' or 'decomposition'
  kind: 'map' | 'decomposition';
  position: number; // Image 1 .. 3; 4 for the decomposition image
  maps: PlanMap[];
  settings: SheetSettings;
  layout: PackedLayout;
  sizePx: number; // the square side the resolution key stands for
  label: string; // "Image 2 (Normal)", "Metal-Roughness image"
}

export type StepResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** What the describe step answers (masks R1-R8); the masks wave owns its content. */
export interface DescribeAnswer {
  components: ReadonlyArray<{ name: string; description: string; location: string }>;
}

/** Everything a run needs from outside: the provider call, pixels, the masks steps and the maps commit. The app binds them; tests give fakes. */
export interface RunPorts {
  generateImage(provider: Provider, request: GenerateRequest, signal: AbortSignal): Promise<Result<GeneratedImage, ProviderError>>;
  decodeImage(blob: Blob): Promise<PixelImage | null>;
  /** R6, generate R29: the albedo tile scaled to the reference size setting, as a file to send. */
  makeAlbedoReference(tile: PixelImage): Promise<Blob>;
  /** R42: the cut tiles become the originals of their maps in one commit; false when it was not stored. */
  commitMaps(maps: readonly GeneratedMap[]): Promise<boolean>;
  /** R6, masks R1-R8: names the components of the albedo reference. */
  describeAlbedo(albedoReference: Blob, userText: string, signal: AbortSignal): Promise<StepResult<DescribeAnswer>>;
  /** R37, masks R12: the decomposition prompt for the components. */
  buildDecompositionPrompt(answer: DescribeAnswer): string;
  /** R51, masks R14: the decomposition image is handed over whole. False (with a message) when the masks steps refuse it. */
  acceptDecomposition(image: Blob, pixels: PixelImage, answer: DescribeAnswer, signal: AbortSignal): Promise<StepResult<void>>;
  now(): number;
}

/** R56: what a retry keeps; memory only. */
export interface RunCheckpoint {
  plan: GenerationPlan;
  userText: string;
  colorMode: 'albedo' | 'diffuse';
  references: Blob[];
  finished: string[]; // job ids that were validated, split and committed
  albedoReference: Blob | null;
  describe: DescribeAnswer | null;
}

export type ImageStatus = 'done' | 'failed' | 'cancelled' | 'skipped';

/** R68, R69: one attempt at one image, as the run log shows it. */
export interface ImageAttempt {
  jobId: string;
  label: string;
  maps: string[];
  model: string;
  resolutionKey: string;
  quality: string | null;
  canvas: string; // "2048 x 1024"
  layout: string; // "2x1"
  tilePx: number;
  referenceNames: string[];
  prompt: string; // exactly as sent
  status: ImageStatus;
  durationMs: number;
  mimeType: string | null;
  returnedSize: string | null;
  note: string | null; // "JPEG source", "scaled up"
  error: string | null;
  thumbnail: Blob | null;
}

export interface DescribeAttempt {
  status: ImageStatus;
  durationMs: number;
  answerLength: number | null;
  error: string | null;
}

export interface RunFailure {
  jobId: string; // an image id or 'describe'
  message: string; // names the image: "Image 3 (Height): ..."
  retryable: boolean;
  category: string;
}

export type RunStatus = 'done' | 'partial' | 'failed' | 'cancelled';

export interface RunReport {
  status: RunStatus;
  message: string; // R43, R60
  committed: string[]; // names of the maps kept, in plan order
  failures: RunFailure[];
  attempts: ImageAttempt[];
  describeAttempt: DescribeAttempt | null;
  checkpoint: RunCheckpoint; // for Retry
  packedWarning: boolean; // R50: a packed image was cut
}

export interface RunProgress {
  finished: number;
  total: number;
}
