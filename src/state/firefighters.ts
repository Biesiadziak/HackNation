type PosRecord = { t: number; x: number; y: number; z: number };

// In-memory store of positions
const store: Record<string, PosRecord[]> = {};

// Metadata (like floor) per firefighter
const meta: Record<string, { floor: number | null }> = {};

/**
 * Register a firefighter with optional floor.
 */
export function registerFirefighter(id: string, floor: number | null = null) {
  if (!store[id]) store[id] = [];
  if (!meta[id]) meta[id] = { floor: null };
  if (floor !== null) meta[id].floor = floor;
}

/**
 * Record a firefighter position
 */
export function recordPosition(id: string, pos: [number, number, number]) {
  if (!store[id]) store[id] = [];
  store[id].push({ t: Date.now(), x: pos[0], y: pos[1], z: pos[2] });
}

/**
 * Get a snapshot of all firefighter positions
 */
export function getSnapshot(): Record<string, { records: PosRecord[] }> {
  return Object.fromEntries(
    Object.entries(store).map(([id, positions]) => [id, { records: positions }])
  );
}

/**
 * Reset all stored data
 */
export function resetStore() {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.keys(meta).forEach((k) => delete meta[k]);
}

export default store;
