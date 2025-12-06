import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, AxesHelper, GridHelper } from "@react-three/drei";
import { useState, useEffect } from "react";
import Building from "./Building";
import LandingPage from "./LandingPage";
import "./index.css";

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

  const [address, setAddress] = useState("Złota 44, Warsaw, Poland");
  const [footprint, setFootprint] = useState<[number, number][] | undefined>(undefined);
  const [buildingLevels, setBuildingLevels] = useState<number>(3);

  const fetchFootprint = async () => {
    try {
      const response = await fetch(`http://localhost:5000/footprint?address=${encodeURIComponent(address)}`);
      if (response.ok) {
        const data = await response.json();
        setFootprint(data.coords);
        if (data.levels) {
            setBuildingLevels(Math.round(data.levels));
        }
      } else {
        console.error("Failed to fetch footprint");
        alert("Failed to fetch footprint");
      }
    } catch (error) {
      console.error("Error fetching footprint:", error);
      alert("Error fetching footprint");
    }
  };

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
          {Array.from({ length: Math.max(0, buildingLevels - 1) }, (_, i) => i + 1).map(floor => (
             <option key={floor} value={floor}>Floor {floor}</option>
          ))}
        </select>
        
        <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
            <input 
                type="text" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="Enter address"
                style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', color: 'black' }}
            />
            <button onClick={fetchFootprint} style={{ padding: '5px 10px', cursor: 'pointer', color: 'black' }}>
                Load
            </button>
        </div>
      </div>

      <h1 className="app-title">3D Firefighter Localization</h1>

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
          footprint={footprint}
          levels={buildingLevels}
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
    </div>
  );
}
