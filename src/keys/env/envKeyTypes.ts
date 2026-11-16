export type EnvReadResult = { ok: true; value: string } | { ok: false; reason: 'not-set' | 'unavailable' };

/**
 * Api-keys R21: what the key module asks of a host to read an environment variable. Adapters live outside keys/ (the desktop command,
 * the offline launcher); a host that cannot read one has no adapter. An empty variable is answered as `not-set`.
 */
export interface EnvKeySource {
  /** True when the host can read the environment. Asked once, at start (R14). */
  available(): Promise<boolean>;
  read(name: string, signal?: AbortSignal): Promise<EnvReadResult>;
  /** The host sees the environment as it was when the app started, so a variable set later needs a restart (R16). */
  readonly needsRestart: boolean;
}
