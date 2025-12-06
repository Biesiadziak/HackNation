type PosRecord = { t: number; x: number; y: number; z: number };

const store: Record<string, PosRecord[]> = {};
const meta: Record<string, { floor: number | null }> = {};

export function registerFirefighter(id: string, floor: number | null = null) {
  if (!store[id]) store[id] = [];
  if (floor !== null) meta[id] = { floor };
  if (!meta[id]) meta[id] = { floor: null };
}

export function recordPosition(id: string, pos: [number, number, number]) {
  if (!store[id]) store[id] = [];
  store[id].push({ t: Date.now(), x: pos[0], y: pos[1], z: pos[2] });
}

export function getSnapshot() {
  // return object mapping id -> { floor, records }
  const out: Record<string, { floor: number | null; records: PosRecord[] }> = {};
  for (const id of Object.keys(store)) {
    out[id] = { floor: meta[id]?.floor ?? null, records: JSON.parse(JSON.stringify(store[id])) };
  }
  return out;
}

export function resetStore() {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.keys(meta).forEach((k) => delete meta[k]);
}

export default store;
