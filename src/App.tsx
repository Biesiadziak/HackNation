import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState, useEffect } from "react";
import Building from "./Building";
import LandingPage from "./LandingPage";
import "./index.css";
import { getSnapshot } from "./state/firefighters";
import { exportToCsv } from "./utils/exportData";

export default function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firefighters, setFirefighters] = useState<Record<string, any>>({});
  
  // Calibration State
  const [config, setConfig] = useState({
    scale: 1,
    swapYZ: false,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
  });

  // Floor selection: null = overview, number = focused floor
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  // Firefighter list panel collapsed state
  const [listExpanded, setListExpanded] = useState(true);

  useEffect(() => {
    const ws = new WebSocket('wss://niesmiertelnik.replit.app/ws');
    
    ws.onopen = () => console.log("Connected to WebSocket");
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'tag_telemetry') {
                setFirefighters(prev => ({
                    ...prev,
                    [data.firefighter.id]: data
                }));
            }
        } catch(e) { console.error(e); }
    };
    
    return () => ws.close();
  }, []);

  const selected = selectedId ? firefighters[selectedId] : null;

  // When a firefighter is selected, auto-focus on their floor
  useEffect(() => {
    if (selected) {
      const rawZ = typeof selected.z === 'number' ? selected.z : (selected.position?.z ?? 0);
      const z = rawZ * config.scale + config.offsetZ;
      const FLOOR_HEIGHT = 3.2;
      const firefighterFloor = Math.round(z / FLOOR_HEIGHT);
      // Clamp to valid floor range
      const clampedFloor = Math.max(-1, Math.min(2, firefighterFloor));
      setSelectedFloor(clampedFloor);
    }
  }, [selectedId, selected, config.scale, config.offsetZ]);

  if (view === 'landing') {
    return <LandingPage onStart={() => setView('app')} />;
  }

  return (
    <div className="app-container">
      <button className="back-button" onClick={() => setView('landing')}>
        ← Go Back
      </button>

      {/* Floor Selection Menu */}
      <div className="floor-selector">
        <label>Floor View:</label>
        <select 
          value={selectedFloor ?? 'all'} 
          onChange={(e) => setSelectedFloor(e.target.value === 'all' ? null : parseInt(e.target.value))}
        >
          <option value="all">All Floors (Overview)</option>
          <option value="-1">Floor -1 (Basement)</option>
          <option value="0">Floor 0 (Ground)</option>
          <option value="1">Floor 1</option>
          <option value="2">Floor 2</option>
        </select>
      </div>

      <h1 className="app-title">3D Firefighter Localization</h1>

      {/* --- Firefighter List Panel (Left Side) --- */}
      <div className={`firefighter-list-panel ${listExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="list-header" onClick={() => setListExpanded(!listExpanded)}>
          <span className="list-toggle">{listExpanded ? '◀' : '▶'}</span>
          <h3>Firefighters ({Object.keys(firefighters).length})</h3>
        </div>
        {listExpanded && (
          <div className="list-content">
            {Object.values(firefighters).length === 0 ? (
              <p className="no-firefighters">Waiting for data...</p>
            ) : (
              Object.values(firefighters).map((ff: any) => {
                const isSelected = selectedId === ff.firefighter.id;
                const heartRate = ff.vitals?.heart_rate_bpm;
                const isAlert = heartRate > 120 || heartRate < 50;
                
                // Calculate firefighter's floor
                const rawZ = typeof ff.z === 'number' ? ff.z : (ff.position?.z ?? 0);
                const z = rawZ * config.scale + config.offsetZ;
                const FLOOR_HEIGHT = 3.2;
                const ffFloor = Math.round(z / FLOOR_HEIGHT);
                const floorLabel = ffFloor === -1 ? 'B1' : ffFloor === 0 ? 'G' : `F${ffFloor}`;
                
                return (
                  <div
                    key={ff.firefighter.id}
                    className={`firefighter-list-item ${isSelected ? 'selected' : ''} ${isAlert ? 'alert' : ''}`}
                    onClick={() => setSelectedId(ff.firefighter.id)}
                  >
                    <div className="ff-header">
                      <span className="ff-name">{ff.firefighter.name}</span>
                      <span className="ff-floor">{floorLabel}</span>
                    </div>
                    <div className="ff-stats">
                      <span className="ff-heart">❤️ {heartRate ?? '--'}</span>
                      <span className="ff-state">{ff.vitals?.motion_state ?? '--'}</span>
                    </div>
                    <div className="ff-scba">
                      🛡️ {ff.scba?.cylinder_pressure_bar?.toFixed(0) ?? '--'} bar
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* --- 3D Scene --- */}
      <Canvas camera={{ position: [20, 30, 40], fov: 50, up: [0, 0, 1] }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[-10, 20, -10]} intensity={0.5} />
        
        <axesHelper args={[5]} />
        
        <Building 
          firefighters={firefighters} 
          onSelect={setSelectedId} 
          config={config}
          selectedFloor={selectedFloor}
        />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} maxPolarAngle={Math.PI / 2} />
      </Canvas>

      {/* --- UI Panel for firefighter vitals --- */}
      {selected && (
        <div className="info-panel">
          <h2>{selected.firefighter.name}</h2>
          <p><strong>ID:</strong> <span>{selected.firefighter.id}</span></p>
          <p><strong>Pos:</strong> <span>
            {selected.x?.toFixed(1) ?? selected.position?.x?.toFixed(1)}, 
            {selected.y?.toFixed(1) ?? selected.position?.y?.toFixed(1)}, 
            {selected.z?.toFixed(1) ?? selected.position?.z?.toFixed(1)}
          </span></p>
          <p><strong>Heart Rate:</strong> <span>{selected.vitals?.heart_rate_bpm} bpm</span></p>
          <p><strong>State:</strong> <span>{selected.vitals?.motion_state}</span></p>
          <p><strong>SCBA:</strong> <span>{selected.scba?.cylinder_pressure_bar?.toFixed(0) ?? 'N/A'} bar</span></p>
          <button onClick={() => setSelectedId(null)}>Close</button>
        </div>
      )}

      <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 999 }}>
        <button onClick={async () => {
          const snap = getSnapshot();
          await exportToCsv(snap);
          // optional: clear after export
          // resetStore();
        }}>Export CSV</button>
      </div>
    </div>
  );
}
