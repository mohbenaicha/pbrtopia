import { serveWorkerJobs, type WorkerJobScope } from '@shared/workerJob';
import { runNormalJob, type NormalJobInput } from './normalJob';

// Normal-from-height R10: the worker side of the normal job. It runs the one job it is sent and answers with the picture or the failure.
serveWorkerJobs(globalThis as unknown as WorkerJobScope, (kind, input) => {
  if (kind !== 'normal') throw new Error(`Unknown normal job: ${kind}`);
  return runNormalJob(input as NormalJobInput);
});
