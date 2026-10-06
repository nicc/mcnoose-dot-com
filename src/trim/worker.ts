// Paints trim lengths off the main thread: one job in, its pixels out (see length.ts). Painted
// lengths are kept in the origin's private file system (OPFS), named by a hash of the job's cache
// key and the drawing code, so a repeat visit at the same window size and density reads them back
// instead of painting (a few ms each rather than tens). Workers only: Safari writes OPFS through
// sync access handles, which exist nowhere else. The store is capped and the oldest files go first.
import { paintPixels, type LengthJob } from './paint';

export interface LengthRequest {
  id: string;
  key: string;
  job: LengthJob;
}

export interface LengthResult {
  id: string;
  key: string;
  px: Uint8ClampedArray;
  cached: boolean; // read back rather than painted
}

const STORE = 'trim-lengths';
const CAP_BYTES = 48 << 20; // across every window size and density this browser has seen
const SWEEP_EVERY = 25; // writes between checks of the store's size

// Sync access handles aren't in the DOM typings this project compiles against.
interface SyncHandle {
  getSize(): number;
  read(buffer: ArrayBufferView, options?: { at: number }): number;
  write(buffer: ArrayBufferView, options?: { at: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}
type FileHandle = FileSystemFileHandle & { createSyncAccessHandle(): Promise<SyncHandle> };
type Dir = FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> };

const store: Promise<Dir | undefined> = (async () => {
  try {
    return (await (await navigator.storage.getDirectory()).getDirectoryHandle(STORE, { create: true })) as Dir;
  } catch {
    return undefined; // no OPFS here (some private windows): every length is painted
  }
})();

async function fileName(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${__TRIM_CODE__}\n${key}`));
  return Array.from(new Uint8Array(digest).subarray(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function read(dir: Dir, name: string, bytes: number): Promise<Uint8ClampedArray | undefined> {
  try {
    const handle = await (await dir.getFileHandle(name) as FileHandle).createSyncAccessHandle();
    try {
      if (handle.getSize() !== bytes) return undefined;
      const px = new Uint8ClampedArray(bytes);
      return handle.read(px, { at: 0 }) === bytes ? px : undefined;
    } finally {
      handle.close();
    }
  } catch {
    return undefined;
  }
}

let writes = 0;
async function write(dir: Dir, name: string, px: Uint8ClampedArray): Promise<void> {
  try {
    const handle = await (await dir.getFileHandle(name, { create: true }) as FileHandle).createSyncAccessHandle();
    try {
      handle.truncate(0);
      handle.write(px, { at: 0 });
      handle.flush();
    } finally {
      handle.close();
    }
    if (++writes % SWEEP_EVERY === 0) await sweep(dir);
  } catch {
    // out of quota, or another worker has the file open: it's only a cache
  }
}

// Over the cap: drop the least recently written until comfortably under it.
async function sweep(dir: Dir): Promise<void> {
  const files: { name: string; size: number; at: number }[] = [];
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file') continue;
    const f = await (h as FileSystemFileHandle).getFile();
    files.push({ name, size: f.size, at: f.lastModified });
  }
  let total = files.reduce((s, f) => s + f.size, 0);
  if (total <= CAP_BYTES) return;
  for (const f of files.sort((a, b) => a.at - b.at)) {
    if (total <= CAP_BYTES * 0.75) break;
    await dir.removeEntry(f.name).catch(() => {});
    total -= f.size;
  }
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<LengthRequest>) => void) | null; postMessage(m: LengthResult, transfer: Transferable[]): void };
scope.onmessage = async (e) => {
  const { id, key, job } = e.data;
  const dir = await store, name = dir && (await fileName(key));
  let px = dir && name ? await read(dir, name, job.len * job.total * 4) : undefined;
  const cached = !!px;
  if (!px) {
    px = paintPixels(job);
    if (dir && name) await write(dir, name, px); // before handing it back: the buffer is transferred
  }
  scope.postMessage({ id, key, px, cached }, [px.buffer]);
};
