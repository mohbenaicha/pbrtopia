import { serveWorkerJobs, type WorkerJobScope } from '@shared/workerJob';
import { runHeightJob, type HeightJobInput } from './heightJob';

// Masks R24, R82: the worker side of the height job. It runs the one job it is sent and answers with the result or the failure.
serveWorkerJobs(globalThis as unknown as WorkerJobScope, (kind, input) => {
  if (kind !== 'height') throw new Error(`Unknown height job: ${kind}`);
  return runHeightJob(input as HeightJobInput);
});
