import { saveAs } from 'file-saver';

type PosRecord = { t: number; x: number; y: number; z: number };

function msToHMS(ms: number) {
  const d = new Date(ms);
  return d.toISOString();
}

export async function exportToCsv(snapshot: Record<string, { floor: number | null; records: PosRecord[] }>) {
  const ids = Object.keys(snapshot);
  if (ids.length === 0) {
    alert('No firefighter data to export');
    return;
  }

  const lines: string[] = [];
  // header
  lines.push('id,floor,timestamp,x,y,z');

  for (const id of ids) {
    const { floor, records } = snapshot[id];
    for (const r of records) {
      lines.push([id, floor ?? '', msToHMS(r.t), r.x, r.y, r.z].join(','));
    }
  }

  const csv = lines.join('\n');
  const fname = `firefighters-${new Date().toISOString().slice(0,19)}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, fname);
}

export default exportToCsv;
