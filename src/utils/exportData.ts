import { saveAs } from 'file-saver';

type PosRecord = { t: number; x: number; y: number; z: number };

function msToHMS(ms: number) {
  const d = new Date(ms);
  return d.toISOString();
}

export async function exportPerFirefighter(snapshot: Record<string, { floor: number | null; records: PosRecord[] }>) {
  const ids = Object.keys(snapshot);
  if (ids.length === 0) {
    alert('No firefighter data to export');
    return;
  }

  for (const id of ids) {
    const { floor, records } = snapshot[id];
    const lines: string[] = [];
    lines.push('id,floor,timestamp,x,y,z');
    for (const r of records) {
      lines.push([id, floor ?? '', msToHMS(r.t), r.x, r.y, r.z].join(','));
    }

    const csv = lines.join('\n');
    const safeId = id.replace(/[^a-z0-9-_]/gi, '_');
    const fname = `firefighter-${safeId}-floor-${floor ?? 'N/A'}-${new Date().toISOString().slice(0,19)}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, fname);
  }
}

export default exportPerFirefighter;
