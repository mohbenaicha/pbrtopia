import { serveWorkerJobs, type WorkerJobScope } from '@mat/workerjob';
import type { EmbedJobInput } from './createWorkerEmbedder';
import { runMiniLmEmbedding } from './runMiniLmEmbedding';

// Masks R73: the worker side. It embeds the texts it is sent and answers with the vectors or the failure.
serveWorkerJobs(globalThis as unknown as WorkerJobScope, (_kind, input) => runMiniLmEmbedding((input as EmbedJobInput).texts));
