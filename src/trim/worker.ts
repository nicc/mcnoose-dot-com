// Paints trim lengths off the main thread: one job in, its pixels out (see length.ts).
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
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<LengthRequest>) => void) | null; postMessage(m: LengthResult, transfer: Transferable[]): void };
scope.onmessage = (e) => {
  const px = paintPixels(e.data.job);
  scope.postMessage({ id: e.data.id, key: e.data.key, px }, [px.buffer]);
};
