import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Building from './Building';
import { getSnapshot } from './state/firefighters';
import { exportToCsv } from './utils/exportData';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

// Helper to set initial camera target without resetting it on every render
function CameraHandler({ initialTarget, controlsRef }: { initialTarget?: [number, number, number], controlsRef: any }) {
  useEffect(() => {
    if (controlsRef.current && initialTarget) {
      controlsRef.current.target.set(...initialTarget);
      controlsRef.current.update();
    }
  }, []); // Run only on mount
  return null;
}

type PathLineProps = { points: number[][]; color?: string };

function PathLine({ points, color = 'orange' }: PathLineProps) {
  const lineRef = useRef<Line2>(null);
  const { geom, mat } = useMemo(() => {
    const g = new LineGeometry();
    g.setPositions(points.flat());
    const m = new LineMaterial({ color, linewidth: 0.3, worldUnits: true });
    return { geom: g, mat: m };
  }, [points, color]);
  return <primitive ref={lineRef} object={new Line2(geom, mat)} />;
}

export default function Movement({
  onBack,
  footprint,
  levels,
  selectedFloor,
  initialCameraState,
}: {
  onBack: (cameraState?: { position: [number, number, number]; target: [number, number, number] }) => void;
  footprint?: [number, number][];
  levels?: number;
  selectedFloor?: number | null;
  initialCameraState?: { position: [number, number, number]; target: [number, number, number] } | null;
}) {
  const snap = getSnapshot();
  const ids = Object.keys(snap).sort();

  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(ids.map((id) => [id, false]))
  );
  const [progress, setProgress] = useState(100);
  const [selectAll, setSelectAll] = useState(false);
  const controlsRef = useRef<any>(null);

  const toggleId = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSelectAll = () => {
    const next = !selectAll;
    setSelected(Object.fromEntries(ids.map((id) => [id, next])));
    setSelectAll(next);
  };

  const exportSelected = async () => {
    const sel = Object.keys(selected).filter((k) => selected[k]);
    const snapshot = getSnapshot();
    const toExport: Record<string, any> = {};
    if (sel.length > 0) sel.forEach((id) => { if (snapshot[id]) toExport[id] = snapshot[id]; });
    else Object.assign(toExport, snapshot);
    await exportToCsv(toExport);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Back button */}
      <button 
        style={{ position: 'absolute', left: 12, top: 12, zIndex: 20 }} 
        onClick={() => {
          let state;
          if (controlsRef.current) {
            const pos = controlsRef.current.object.position;
            const target = controlsRef.current.target;
            state = {
              position: [pos.x, pos.y, pos.z] as [number, number, number],
              target: [target.x, target.y, target.z] as [number, number, number],
            };
          }
          onBack(state);
        }}
      >
        ← Back
      </button>

      {/* Checkbox list and UI */}
      <div style={{ position: 'absolute', left: 12, top: 56, zIndex: 20, background: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 8 }}>
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          <strong style={{ color: '#fff' }}>Firefighters</strong>
          <div style={{ marginTop: 6 }}>
            <button onClick={toggleSelectAll} style={{ marginBottom: 6 }}>
              {selectAll ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {ids.map((id) => (
            <div key={id}>
              <label style={{ color: '#fff' }}>
                <input type="checkbox" checked={selected[id]} onChange={() => toggleId(id)} /> {id}
              </label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ color: '#fff' }}>Progress: {progress}%</label>
          <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(parseInt(e.target.value))} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={exportSelected}>Export CSV (selected/all)</button>
        </div>
      </div>

      <Canvas 
        camera={{ 
          position: initialCameraState?.position ?? [20, 20, 20], 
          fov: 50, 
          up: [0, 0, 1] 
        }} 
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#0f1724' }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[50, 50, 50]} />
        <OrbitControls 
          ref={controlsRef}
          enablePan enableRotate enableZoom enableDamping dampingFactor={0.05} 
        />
        <CameraHandler controlsRef={controlsRef} initialTarget={initialCameraState?.target} />

        {/* Static building: floors load exactly as in layout, no offsets */}
        <Building
          firefighters={{}} // no icons
          onSelect={() => {}}
          config={{ scale: 1, swapYZ: false, offsetX: 0, offsetY: 0, offsetZ: 0 }}
          selectedFloor={null}
          focusedFloors={undefined} // no floor movement
          footprint={footprint}
          levels={levels}
          staticFloors={true} // ignore any firefighter layout
        />

        {/* Firefighter paths */}
        {ids.map((id, idx) => {
          if (!selected[id]) return null;
          const rec = snap[id]; if (!rec) return null;
          const records = rec.records ?? []; if (!records.length) return null;
          const count = Math.max(1, Math.floor((progress / 100) * records.length));
          const pts = records.slice(0, count).map(r => [r.x, r.y, r.z]);
          const color = ['#ff6b6b', '#54a0ff', '#feca57', '#1dd1a1', '#5f27cd'][idx % 5];
          return <PathLine key={id} points={pts} color={color} />;
        })}
      </Canvas>
    </div>
  );
}
