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
    showSettings: false
  });

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

  if (view === 'landing') {
    return <LandingPage onStart={() => setView('app')} />;
  }

  return (
    <div className="app-container">
      <button className="back-button" onClick={() => setView('landing')}>
        ← Go Back
      </button>
      
      <button 
        className="settings-button" 
        onClick={() => setConfig(p => ({...p, showSettings: !p.showSettings}))}
      >
        ⚙️ Settings
      </button>

      {config.showSettings && (
        <div className="settings-panel">
          <h3>Calibration</h3>
          <label>
            Scale: <input type="number" step="0.1" value={config.scale} onChange={e => setConfig({...config, scale: parseFloat(e.target.value)})} />
          </label>
          <label>
            <input type="checkbox" checked={config.swapYZ} onChange={e => setConfig({...config, swapYZ: e.target.checked})} />
            Swap Y/Z (Z-up input)
          </label>
          <div className="offset-inputs">
            <label>Off X: <input type="number" value={config.offsetX} onChange={e => setConfig({...config, offsetX: parseFloat(e.target.value)})} /></label>
            <label>Off Y: <input type="number" value={config.offsetY} onChange={e => setConfig({...config, offsetY: parseFloat(e.target.value)})} /></label>
            <label>Off Z: <input type="number" value={config.offsetZ} onChange={e => setConfig({...config, offsetZ: parseFloat(e.target.value)})} /></label>
          </div>
        </div>
      )}

      <h1 className="app-title">3D Firefighter Localization</h1>

      {/* --- 3D Scene --- */}
      <Canvas camera={{ position: [20, 30, 40], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[-10, 20, -10]} intensity={0.5} />
        
        <axesHelper args={[5]} />
        <gridHelper args={[100, 100]} />
        
        <Building 
          firefighters={firefighters} 
          onSelect={setSelectedId} 
          config={config}
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
