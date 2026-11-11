import type { ExportJob, ExportWorkerReply } from './exportProtocol';
import { runExportJob } from './runExportJob';

/** Export R32: the worker entry. One message in (the job), replies out. */
const scope = self as unknown as {
  onmessage: ((event: { data: ExportJob }) => void) | null;
  postMessage(reply: ExportWorkerReply, transfer?: Transferable[]): void;
};

scope.onmessage = ({ data }) => {
  void runExportJob(data, (reply, transfer) => scope.postMessage(reply, transfer ?? []));
};
