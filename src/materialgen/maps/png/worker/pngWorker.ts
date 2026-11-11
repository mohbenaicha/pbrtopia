import { serveWorkerJobs, type WorkerJobScope } from '@mat/workerjob';
import { runPngJob, type PngJobKind } from './pngJobs';

// Maps R60: the worker side. It runs the one PNG job it is sent and answers with the result or the failure.
serveWorkerJobs(globalThis as unknown as WorkerJobScope, (kind, input) => runPngJob(kind as PngJobKind, input as never));
