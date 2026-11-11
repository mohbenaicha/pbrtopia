import { serveWorkerJobs, type WorkerJobScope } from '@mat/workerjob';
import { runMaskJob, type MaskJobKind } from './maskJobs';

// Masks R24, R45: the worker side. It runs the one job it is sent and answers with the result or the failure.
serveWorkerJobs(globalThis as unknown as WorkerJobScope, (kind, input) => runMaskJob(kind as MaskJobKind, input as never));
