import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = path.resolve('scripts/offline/serve-site.ps1');
const running: ChildProcess[] = [];
const folders: string[] = [];

afterEach(() => {
  for (const child of running.splice(0)) child.kill();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function makeSite(): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'site-'));
  folders.push(folder);
  mkdirSync(path.join(folder, 'assets'));
  writeFileSync(path.join(folder, 'index.html'), '<!doctype html><title>x</title>');
  writeFileSync(path.join(folder, 'assets', 'a.wasm'), 'wasm');
  writeFileSync(path.join(folder, 'assets', 'a.js'), 'export {}');
  return folder;
}

function launch(site: string, port: number): { child: ChildProcess; output: () => string; exited: Promise<number | null> } {
  const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Site', site, '-Port', String(port), '-NoBrowser'], { stdio: ['ignore', 'pipe', 'pipe'] });
  running.push(child);
  let text = '';
  child.stdout?.on('data', (chunk: Buffer) => (text += chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => (text += chunk.toString()));
  return { child, output: () => text, exited: new Promise((resolve) => child.on('exit', (code) => resolve(code))) };
}

async function whenListening(port: number): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('the site did not start');
}

describe('serve-site.ps1 (web-hosting R7, R4)', () => {
  it('TestR7_it_serves_the_index_and_nested_files_with_their_content_types_and_refuses_paths_outside_the_folder', async () => {
    const port = 45123;
    launch(makeSite(), port);
    await whenListening(port);
    const index = await fetch(`http://127.0.0.1:${port}/`);
    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/html');
    const wasm = await fetch(`http://127.0.0.1:${port}/assets/a.wasm`);
    expect(wasm.headers.get('content-type')).toBe('application/wasm');
    const js = await fetch(`http://127.0.0.1:${port}/assets/a.js`);
    expect(js.headers.get('content-type')).toContain('text/javascript');
    expect((await fetch(`http://127.0.0.1:${port}/assets/missing.png`)).status).toBe(404);
    // A path that climbs out of the folder is refused: Windows' HTTP layer closes the connection, or the script answers 404; it is never served.
    const climbing = await fetch(`http://127.0.0.1:${port}/..%2f..%2fWindows%2fwin.ini`).then((reply) => reply.status, () => 'closed');
    expect(['closed', 404]).toContain(climbing);
  }, 30000);

  it('TestR7_a_missing_site_folder_exits_1_with_the_message', async () => {
    const { output, exited } = launch(path.join(tmpdir(), 'no-such-site-folder'), 45124);
    expect(await exited).toBe(1);
    expect(output()).toContain('The site folder was not found. Build it first (npm run build:all) or use the release package.');
  }, 30000);

  it('TestR4_a_busy_port_exits_2_and_names_the_port', async () => {
    const port = 45125;
    const blocker = createServer().listen(port, '127.0.0.1');
    await new Promise((resolve) => blocker.once('listening', resolve));
    try {
      const { output, exited } = launch(makeSite(), port);
      expect(await exited).toBe(2);
      expect(output()).toContain(String(port));
    } finally {
      blocker.close();
    }
  }, 30000);
});
