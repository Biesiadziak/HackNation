import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getSnapshot } from './state/firefighters';
import { exportToCsv } from './utils/exportData';
import Building from './Building';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

/* -------------------------------------------------------
   FIXED VERSION OF PathLine
   ------------------------------------------------------- */
type PathLineProps = {
  points: number[][];   // ⬅ typed
  color?: string;
};

function PathLine({ points, color = 'orange' }: PathLineProps) {
  const lineRef = useRef<Line2>(null);

  const { geom, mat } = useMemo(() => {
    const g = new LineGeometry();
    const flat = points.flat();
    g.setPositions(flat);

    const m = new LineMaterial({
      color,
      linewidth: 0.3, // true 3D thickness
      worldUnits: true,
    });

    return { geom: g, mat: m };
  }, [points, color]);

  return <primitive ref={lineRef} object={new Line2(geom, mat)} />;
}

export default function Movement({ onBack }: { onBack: () => void }) {
  const snap = getSnapshot();
  const ids = Object.keys(snap).sort();

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ids.map((id) => [id, false]))
  );
  const [progress, setProgress] = useState(100);
  const [selectAll, setSelectAll] = useState(false);
  const [autoFitCounter, setAutoFitCounter] = useState(0);
  const controlsRef = useRef<any>(null);
  const userInteractedRef = useRef(false);

  function toggleId(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSelectAll() {
    const next = !selectAll;
    setSelected(Object.fromEntries(ids.map((id) => [id, next])));
    setSelectAll(next);
  }

  /* -------------------------------------------------------
     Build latest position map for live firefighter markers
     ------------------------------------------------------- */
  const latestMap: Record<string, any> = {};
  ids.forEach((id) => {
    const rec = snap[id];
    const records = rec?.records ?? [];
    if (records.length > 0) {
      const last = records[records.length - 1];
      latestMap[id] = {
        firefighter: { id },
        x: last.x + 20,
        y: last.y + 10,
        z: last.z,
        position: { x: last.x, y: last.y, z: last.z },
      };
    }
  });

  /* -------------------------------------------------------
     Export selected (or all)
     ------------------------------------------------------- */
  const exportSelected = async () => {
    const sel = Object.keys(selected).filter((k) => selected[k]);
    const snapshot = getSnapshot();

    let toExport: Record<string, any> = {};
    if (sel.length > 0) {
      sel.forEach((id) => {
        if (snapshot[id]) toExport[id] = snapshot[id];
      });
    } else {
      toExport = snapshot;
    }

    await exportToCsv(toExport);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <button
        style={{ position: 'absolute', left: 12, top: 12, zIndex: 20 }}
        onClick={onBack}
      >
        ← Back
      </button>

      {/* UI PANEL */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 56,
          zIndex: 20,
          background: 'rgba(0,0,0,0.6)',
          padding: 12,
          borderRadius: 8,
        }}
      >
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          <strong style={{ color: '#fff' }}>Firefighters</strong>

          <div style={{ marginTop: 6 }}>
            <button onClick={toggleSelectAll} style={{ marginBottom: 6 }}>
              {selectAll ? 'Deselect All' : 'Select All'}
            </button>

            <button
              onClick={() => {
                userInteractedRef.current = false;
                setAutoFitCounter((c) => c + 1);
              }}
              style={{ marginLeft: 6 }}
            >
              Recenter
            </button>
          </div>

          {ids.map((id) => (
            <div key={id}>
              <label style={{ color: '#fff' }}>
                <input
                  type="checkbox"
                  checked={selected[id]}
                  onChange={() => toggleId(id)}
                />{' '}
                {id}
              </label>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ color: '#fff' }}>Progress: {progress}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(parseInt(e.target.value))}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={exportSelected}>Export CSV (selected/all)</button>
        </div>
      </div>

      {/* 3D VIEW */}
      <Canvas
        camera={{ position: [20, 20, 20], fov: 50, up: [0, 0, 1] }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: '#0f1724',
        }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[50, 50, 50]} />

        {/* Z-UP axes helper */}
        <axesHelper args={[5]} />

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableRotate
          enableZoom
          enableDamping
          dampingFactor={0.05}
          onStart={() => {
            userInteractedRef.current = true;
          }}
        />

        {/* Building */}
        <Building
          firefighters={{}}
          onSelect={() => {}}
          config={{ scale: 1, swapYZ: false, offsetX: 0, offsetY: 0, offsetZ: 0 }}
          selectedFloor={null}
        />

        <AutoFitController
          trigger={autoFitCounter}
          selected={selected}
          progress={progress}
          snapshot={snap}
          controlsRef={controlsRef}
          userInteractedRef={userInteractedRef}
        />

        {/* Firefighter paths */}
        {ids.map((id, idx) => {
          if (!selected[id]) return null;

          const rec = snap[id];
          const records = rec?.records ?? [];
          if (!records.length) return null;

          const count = Math.max(1, Math.floor((progress / 100) * records.length));
          const pts = records.slice(0, count).map((r) => [r.x , r.y, r.z]);

          const color = ['#ff6b6b', '#54a0ff', '#feca57', '#1dd1a1', '#5f27cd'][idx % 5];

          return (
            <group key={id}>
              <PathLine points={pts} color={color} />
              <mesh position={pts[pts.length - 1] as any}>
                <sphereGeometry args={[0.25, 12, 12]} />
                <meshStandardMaterial color={color} />
              </mesh>
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}

/* -------------------------------------------------------
   Auto-fit camera controller
   ------------------------------------------------------- */
function AutoFitController({
  trigger,
  selected,
  progress,
  snapshot,
  controlsRef,
  userInteractedRef,
}: {
  trigger: number;
  selected: Record<string, boolean>;
  progress: number;
  snapshot: Record<string, any>;
  controlsRef: React.MutableRefObject<any>;
  userInteractedRef: React.MutableRefObject<boolean>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (userInteractedRef.current) return;

    const ids = Object.keys(selected).filter((id) => selected[id]);
    const pts: number[] = [];

    ids.forEach((id) => {
      const rec = snapshot[id];
      if (!rec) return;

      const records = rec.records ?? [];
      const count = Math.max(1, Math.floor((progress / 100) * records.length));

      for (let i = 0; i < count; i++) {
        const r = records[i];
        pts.push(r.x, r.y, r.z);
      }
    });

    if (pts.length === 0) {
      camera.position.set(20, 20, 20);
      if (controlsRef.current) controlsRef.current.target.set(20, 10, 0);
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i],
        y = pts[i + 1],
        z = pts[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const center = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

    const maxSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
    const distance = maxSize * 1.8;

    camera.position.set(center.x + distance, center.y + distance, center.z + distance);
    camera.lookAt(center);

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update?.();
    }
  }, [trigger]);

  return null;
}
