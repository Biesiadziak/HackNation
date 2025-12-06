import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import { registerFirefighter, recordPosition } from "./state/firefighters";
import Movement from "./Movement";
import Building from "./Building";
import LandingPage from "./LandingPage";
import "./index.css";
import "./controls.css";
import "./alerts.css";
import "./animations.css";
import { getSnapshot } from "./state/firefighters";
import { exportToCsv } from "./utils/exportData";

interface Alert {
  id: string;
  type: string;
  timestamp: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  firefighter: {
    id: string;
    name: string;
  };
  details?: any;
}

const ALERT_TYPES: Record<string, string> = {
  man_down: "Man Down (No Motion)",
  sos_pressed: "SOS Button Pressed",
  high_heart_rate: "High Heart Rate",
  low_battery: "Low Battery",
  scba_low_pressure: "SCBA Low Pressure",
  scba_critical: "SCBA Critical Pressure",
  beacon_offline: "Beacon Offline",
  tag_offline: "Tag Offline",
  high_temperature: "High Temperature",
  high_co: "High CO Level",
  low_oxygen: "Low Oxygen Level",
  explosive_gas: "Explosive Gas Detected"
};

import { getBuildingFootprint } from './utils/osm';

export default function App() {
  const [view, setView] = useState<'landing' | 'app' | 'movement'>('landing');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firefighters, setFirefighters] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [listExpanded, setListExpanded] = useState(true);
  
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
  const firefightersRef = useRef(firefighters);
  const configRef = useRef(config);

  useEffect(() => { firefightersRef.current = firefighters; }, [firefighters]);
  useEffect(() => { configRef.current = config; }, [config]);

  // Sampler: record positions once per second into the in-memory store
  useEffect(() => {
    const FLOOR_HEIGHT = 3.2;
    const id = setInterval(() => {
      const cur = firefightersRef.current;
      const cfg = configRef.current;
      Object.values(cur).forEach((ff: any) => {
        const fid = ff.firefighter?.id ?? ff.id ?? null;
        if (!fid) return;
        const rawX = typeof ff.x === 'number' ? ff.x : (ff.position?.x ?? 0);
        const rawY = typeof ff.y === 'number' ? ff.y : (ff.position?.y ?? 0);
        const rawZ = typeof ff.z === 'number' ? ff.z : (ff.position?.z ?? 0);

        let x = rawX * cfg.scale;
        let y = rawY * cfg.scale;
        let z = rawZ * cfg.scale;

        if (cfg.swapYZ) {
          const tempY = y;
          y = z;
          z = tempY;
        }

        x += cfg.offsetX;
        y += cfg.offsetY;
        z += cfg.offsetZ;

        const ffFloor = Math.round(z / FLOOR_HEIGHT);
        registerFirefighter(fid, ffFloor);
        recordPosition(fid, [x, y, z]);
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const [address, setAddress] = useState("Wojskowa 10, Poznań, Poland");
  const [footprint, setFootprint] = useState<[number, number][] | undefined>(undefined);
  const [buildingLevels, setBuildingLevels] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<any>(null);

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`);
      const data = await res.json();
      setWeather(data.current);
    } catch (e) {
      console.error("Weather fetch failed", e);
    }
  };

  const fetchFootprint = async () => {
    setIsLoading(true);
    try {
      const data = await getBuildingFootprint(address);
      setFootprint(data.coords);
      if (data.levels) {
          setBuildingLevels(Math.round(data.levels));
      }
      if (data.center) {
          fetchWeather(data.center[0], data.center[1]);
      }
    } catch (error) {
      console.error("Error fetching footprint:", error);
      alert("Error fetching footprint: " + (error as Error).message);
    } finally {
      setIsLoading(false);
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
            } else if (data.type === 'alert') {
                setAlerts(prev => {
                    // Deduplicate: Check if we already have this alert type for this firefighter
                    const exists = prev.some(a => 
                        a.firefighter.id === data.firefighter.id && 
                        a.alert_type === data.alert_type
                    );
                    if (exists) return prev;
                    return [data, ...prev].slice(0, 2);
                });
                
                // Auto-select firefighter in distress if critical
                if (data.severity === 'critical') {
                    setSelectedId(data.firefighter.id);
                }
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

  if (view === 'movement') {
    return <Movement onBack={() => setView('app')} />;
  }

  return (
    <div className="app-container">
      {/* Alert Popups */}
      <div className="alert-container">
        {alerts.map(alert => (
          <div key={alert.id} className={`alert-popup ${alert.severity}`}>
            <div className="alert-icon">
              {alert.severity === 'critical' ? '🚨' : '⚠️'}
            </div>
            <div className="alert-content">
              <div className="alert-header">
                <span className="alert-title">{ALERT_TYPES[alert.alert_type] || alert.alert_type}</span>
                <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="alert-message">
                <strong>{alert.firefighter.name}</strong> ({alert.firefighter.id})
              </div>
              {alert.details && (
                <div className="alert-details">
                  {Object.entries(alert.details)
                    .filter(([key]) => key !== 'imu_orientation')
                    .map(([key, value]) => (
                    <div key={key}>
                        {key.replace(/_/g, ' ')}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="alert-close" onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}>×</button>
          </div>
        ))}
      </div>

      <button className="back-button" onClick={() => setView('landing')}>
        ← Go Back
      </button>

      {weather && (
        <div className="weather-panel">
            <h3>Weather</h3>
            <div className="weather-info">
                <span>🌡️ {weather.temperature_2m}°C</span>
                <span>💨 {weather.wind_speed_10m} km/h</span>
            </div>
        </div>
      )}

      {/* Controls Panel */}
      <div className="controls-panel">
        <div className="control-group">
          <label>Building Address</label>
          <div className="input-group">
            <input 
                type="text" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="Enter address..."
                disabled={isLoading}
            />
            <button onClick={fetchFootprint} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>Floor View</label>
          <select 
            value={selectedFloor ?? 'all'} 
            onChange={(e) => setSelectedFloor(e.target.value === 'all' ? null : parseInt(e.target.value))}
          >
            <option value="all">Overview (All Floors)</option>
            <option value="-1">Basement (B1)</option>
            <option value="0">Ground Floor (0)</option>
            {Array.from({ length: Math.max(0, buildingLevels - 1) }, (_, i) => i + 1).map(floor => (
               <option key={floor} value={floor}>Floor {floor}</option>
            ))}
          </select>
        </div>
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
                
                const roll = Math.abs(ff.imu?.orientation?.roll ?? 0);
                const pitch = Math.abs(ff.imu?.orientation?.pitch ?? 0);
                const isFallen = roll > 45 || pitch > 45;
                
                const isAlert = heartRate > 120 || heartRate < 50 || isFallen;
                
                // Calculate firefighter's floor
                const rawZ = typeof ff.z === 'number' ? ff.z : (ff.position?.z ?? 0);
                const z = rawZ * config.scale + config.offsetZ;
                const FLOOR_HEIGHT = 3.2;
                const ffFloor = Math.round(z / FLOOR_HEIGHT);
                const floorLabel = ffFloor === -1 ? 'B1' : ffFloor === 0 ? 'G' : `F${ffFloor}`;
                
                return (
                  <div
                    key={ff.firefighter.id}
                    className={`firefighter-list-item ${isSelected ? 'selected' : ''} ${isFallen ? 'fallen' : (isAlert ? 'alert' : '')}`}
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
                      <span className="scba-time">
                        (⏳ {ff.scba?.cylinder_pressure_bar ? Math.round(ff.scba.cylinder_pressure_bar * 0.15) : '--'} min)
                      </span>
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
        <ambientLight intensity={0.7} />
        <directionalLight position={[-10, 20, 10]} intensity={0.8} />
        
        <axesHelper args={[5]} />
        
        <Building 
          firefighters={firefighters} 
          onSelect={setSelectedId} 
          selectedId={selectedId}
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
          <p><strong>SCBA:</strong> <span>
            {selected.scba?.cylinder_pressure_bar?.toFixed(0) ?? 'N/A'} bar
            <span style={{color: '#aaa', marginLeft: '8px', fontSize: '0.9em'}}>
                (⏳ {selected.scba?.cylinder_pressure_bar ? Math.round(selected.scba.cylinder_pressure_bar * 0.15) : '--'} min)
            </span>
          </span></p>
          {(Math.abs(selected.imu?.orientation?.pitch ?? 0) > 45 || Math.abs(selected.imu?.orientation?.roll ?? 0) > 45) && (
             <p style={{color: '#ff4757', fontWeight: 'bold', margin: '5px 0'}}>⚠️ FIREFIGHTER FALLEN</p>
          )}
          <button onClick={() => setSelectedId(null)}>Close</button>
        </div>
      )}

      <div style={{ position: 'fixed', left: 180, bottom: 30, zIndex: 999 }}>
        <button onClick={async () => {
          const snap = getSnapshot();
          await exportToCsv(snap);
        }}>Export CSV</button>
        <button style={{ marginLeft: 8 }} onClick={() => setView('movement')}>Open Movement</button>
      </div>
    </div>
  );
}