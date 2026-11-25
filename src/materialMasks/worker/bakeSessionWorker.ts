import { createSessionHost, type SessionReply, type SessionRequest } from './bakeSessionHost';

// Mask-bake-session R5: the session's own worker entry. `serveWorkerJobs` answers one job and ends, so a session, which keeps its state across edits, cannot use it.
interface SessionScope {
  onmessage: ((event: { data: SessionRequest }) => void) | null;
  postMessage(message: SessionReply, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as SessionScope;
const host = createSessionHost((reply, transfer) => scope.postMessage(reply, transfer));
scope.onmessage = (event) => host.handle(event.data);
