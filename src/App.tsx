import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import Building from "./Building";
import LandingPage from "./LandingPage";
import Movement from "./Movement";
import "./index.css";
import "./controls.css";
import "./alerts.css";
import "./animations.css";
import { exportToCsv } from "./utils/exportData";
import { getBuildingFootprint } from "./utils/osm";
import { registerFirefighter, recordPosition, getSnapshot } from './state/firefighters';

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

interface Alert {
  id: string;
  type: string;
  timestamp: string;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  firefighter: { id: string; name: string };
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
  explosive_gas: "Explosive Gas Detected",
};

export default function App() {
  const [view, setView] = useState<"landing" | "app" | "movement">("landing");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firefighters, setFirefighters] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [listExpanded, setListExpanded] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  // Calibration and building state
  const [config, setConfig] = useState({ scale: 1, swapYZ: false, offsetX: 0, offsetY: 0, offsetZ: 0 });
  const [address, setAddress] = useState("Wojskowa 10, Poznań, Poland");
  const [footprint, setFootprint] = useState<[number, number][] | undefined>(undefined);
  const [buildingLevels, setBuildingLevels] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<any>(null);

  // Camera state persistence
  const controlsRef = useRef<any>(null);
  const cameraState = useRef<{ position: [number, number, number]; target: [number, number, number] } | null>(null);

  // Firefighter position tracking for CSV

  // Fetch weather
  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`
      );
      const data = await res.json();
      setWeather(data.current);
    } catch (e) {
      console.error("Weather fetch failed", e);
    }
  };

  // Fetch building footprint
  const fetchFootprint = async () => {
    setIsLoading(true);
    try {
      const data = await getBuildingFootprint(address);
      setFootprint(data.coords);
      if (data.levels) setBuildingLevels(Math.round(data.levels));
      if (data.center) fetchWeather(data.center[0], data.center[1]);
    } catch (error) {
      console.error("Error fetching footprint:", error);
      alert("Error fetching footprint: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // WebSocket listener for telemetry and alerts
  useEffect(() => {
    const ws = new WebSocket("wss://niesmiertelnik.replit.app/ws");

    ws.onopen = () => console.log("Connected to WebSocket");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "tag_telemetry") {
          const id = data.firefighter.id;
          const x = data.x ?? data.position?.x ?? 0;
          const y = data.y ?? data.position?.y ?? 0;
          const z = data.z ?? data.position?.z ?? 0;

          // Update firefighter state with movement tracking
          setFirefighters((prev) => {
            const prevData = prev[id];
            const now = Date.now();
            let lastMoveTime = prevData?.lastMoveTime ?? now;

            // Check if position changed significantly (> 0.1m)
            if (prevData) {
                const prevX = prevData.x ?? prevData.position?.x ?? 0;
                const prevY = prevData.y ?? prevData.position?.y ?? 0;
                const prevZ = prevData.z ?? prevData.position?.z ?? 0;
                const dist = Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2) + Math.pow(z - prevZ, 2));
                
                if (dist > 0.1) {
                    lastMoveTime = now;
                }
            }

            return {
                ...prev,
                [id]: { ...data, lastMoveTime }
            };
          });

          // Record movement
          recordPosition(id, [x, y, z]);

        } else if (data.type === "alert") {
          setAlerts((prev) => {
            const exists = prev.some(
              (a) => a.firefighter.id === data.firefighter.id && a.alert_type === data.alert_type
            );
            if (exists) return prev;
            return [data, ...prev].slice(0, 50);
          });

          // if (data.severity === "critical") setSelectedId(data.firefighter.id);
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => ws.close();
  }, []);

  const selected = selectedId ? firefighters[selectedId] : null;

  // Auto-focus on firefighter floor
  useEffect(() => {
    if (selected) {
      const rawZ = typeof selected.z === "number" ? selected.z : selected.position?.z ?? 0;
      const z = rawZ * config.scale + config.offsetZ;
      const FLOOR_HEIGHT = 3.2;
      const firefighterFloor = Math.round(z / FLOOR_HEIGHT);
      const clampedFloor = Math.max(-1, Math.min(buildingLevels - 1, firefighterFloor));
      setSelectedFloor(clampedFloor);
    }
  }, [selected, config.scale, config.offsetZ, buildingLevels]);

  // Focus camera on selected firefighter
  useEffect(() => {
    if (selectedId && firefighters[selectedId] && controlsRef.current) {
      const ff = firefighters[selectedId];
      let x = (ff.x ?? ff.position?.x ?? 0) * config.scale + config.offsetX;
      let y = (ff.y ?? ff.position?.y ?? 0) * config.scale + config.offsetY;
      let z = (ff.z ?? ff.position?.z ?? 0) * config.scale + config.offsetZ;
      
      if (config.swapYZ) {
        const temp = y;
        y = z;
        z = temp;
      }

      controlsRef.current.target.set(x, y, z);
      controlsRef.current.update();
    }
  }, [selectedId]);

const firefighterPositions = useRef<Record<string, { x: number; y: number; z: number }[]>>({});
const lastAlertTime = useRef<Record<string, number>>({});

// Refs for interval access
const firefightersRef = useRef(firefighters);
const alertsRef = useRef(alerts);
const selectedIdRef = useRef(selectedId);

useEffect(() => { firefightersRef.current = firefighters; }, [firefighters]);
useEffect(() => { alertsRef.current = alerts; }, [alerts]);
useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

useEffect(() => {
  const configRef = { scale: config.scale, swapYZ: config.swapYZ, offsetX: config.offsetX, offsetY: config.offsetY, offsetZ: config.offsetZ };
  const interval = setInterval(() => {
    const now = Date.now();
    const ffs = firefightersRef.current;
    const currentAlerts = alertsRef.current;

    Object.values(ffs).forEach((ff: any) => {
      const id = ff.firefighter?.id;
      if (!id) return;
      let x = (ff.x ?? ff.position?.x ?? 0) * configRef.scale + configRef.offsetX;
      let y = (ff.y ?? ff.position?.y ?? 0) * configRef.scale + configRef.offsetY;
      let z = (ff.z ?? ff.position?.z ?? 0) * configRef.scale + configRef.offsetZ;
      if (configRef.swapYZ) [y, z] = [z, y];

      if (!firefighterPositions.current[id]) firefighterPositions.current[id] = [];
      firefighterPositions.current[id].push({ x, y, z });
      recordPosition(id, [x, y, z]); // optional if you want to sync with state

      // Check for Man Down
      const timeSinceMove = now - (ff.lastMoveTime ?? now);
      const isStationary = timeSinceMove > 30000; // 30s
      const heartRate = ff.vitals?.heart_rate_bpm;
      const isCriticalHR = heartRate > 120 || heartRate < 40;
      
      if (isStationary || isCriticalHR) {
         // Check if alert already exists
         const exists = currentAlerts.some(a => a.firefighter.id === id && a.alert_type === 'man_down');
         const lastTime = lastAlertTime.current[id] || 0;
         // 120s cooldown to prevent immediate re-alert after dismissal
         const canAlert = !exists && (now - lastTime > 120000);
         
         if (canAlert) {
             lastAlertTime.current[id] = now;
             const newAlert: Alert = {
                 id: `local-${id}-${now}`,
                 type: 'alert',
                 timestamp: new Date().toISOString(),
                 alert_type: 'man_down',
                 severity: 'critical',
                 firefighter: ff.firefighter,
                 details: {
                     reason: isStationary ? 'No motion detected' : 'Critical Heart Rate',
                     heart_rate: heartRate
                 }
             };
             
             setAlerts(prev => {
                 if (prev.some(a => a.firefighter.id === id && a.alert_type === 'man_down')) return prev;
                 return [newAlert, ...prev].slice(0, 50);
             });
         }
      }
    });
  }, 1000);
  return () => clearInterval(interval);
}, [config]);

// --- CSV Export ---
const handleExportCsv = async () => {
  const snap = getSnapshot(); // now contains data
  await exportToCsv(snap);
};

  if (view === "landing") {
    return <LandingPage onStart={() => setView("app")} />;
  }

  if (view === "movement") {
    return (
      <Movement
        onBack={(finalCameraState) => {
          if (finalCameraState) {
            cameraState.current = finalCameraState;
          }
          setView("app");
        }}
        selectedFloor={selectedFloor}
        footprint={footprint}
        levels={buildingLevels}
        initialCameraState={cameraState.current}
      />
    );
  }

return (
  <div className="app-container">
    {/* Alert popups */}
    <div className="alert-container">
      {alerts.map((alert) => (
        <div key={alert.id} className={`alert-popup ${alert.severity}`}>
          <div className="alert-icon">{alert.severity === "critical" ? "🚨" : "⚠️"}</div>
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
                  .filter(([key]) => key !== "imu_orientation")
                  .map(([key, value]) => (
                    <div key={key}>
                      {key.replace(/_/g, " ")}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </div>
                  ))}
              </div>
            )}
          </div>
          <button
            className="alert-close"
            onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>

    {/* Go Back button */}
    <button className="back-button" onClick={() => setView("landing")}>
      ← Go Back
    </button>

    {/* Weather */}
    {weather && (
      <div className="weather-panel">
        <h3>Weather</h3>
        <div className="weather-info">
          <span>🌡️ {weather.temperature_2m}°C</span>
          <span>💨 {weather.wind_speed_10m} km/h</span>
        </div>
      </div>
    )}

    {/* Controls */}
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
            {isLoading ? "Loading..." : "Load"}
          </button>
        </div>
      </div>

      <div className="control-group">
        <label>Floor View</label>
        <select
          value={selectedFloor ?? "all"}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "all") {
              setSelectedFloor(null);
              setSelectedId(null);
            } else {
              setSelectedFloor(parseInt(val));
            }
          }}
        >
          <option value="all">Overview (All Floors)</option>
          <option value="-1">Basement (B1)</option>
          <option value="0">Ground Floor (0)</option>
          {Array.from({ length: Math.max(0, buildingLevels - 1) }, (_, i) => i + 1).map((floor) => (
            <option key={floor} value={floor}>
              Floor {floor}
            </option>
          ))}
        </select>
      </div>
    </div>

    <h1 className="app-title">3D Firefighter Localization</h1>

    {/* Firefighter list */}
    <div className={`firefighter-list-panel ${listExpanded ? "expanded" : "collapsed"}`}>
      <div className="list-header" onClick={() => setListExpanded(!listExpanded)}>
        <span className="list-toggle">{listExpanded ? "◀" : "▶"}</span>
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
              
              // Man Down Logic: Stationary for > 30s OR Critical Heart Rate
              const timeSinceMove = Date.now() - (ff.lastMoveTime ?? Date.now());
              const isStationary = timeSinceMove > 30000;
              const isCriticalHR = heartRate > 120 || heartRate < 40;
              const isManDown = isStationary || isCriticalHR;
              
              // Alert logic: Man Down takes precedence
              const itemClass = isManDown ? "alert" : "";

              const rawZ = typeof ff.z === "number" ? ff.z : ff.position?.z ?? 0;
              const z = rawZ * config.scale + config.offsetZ;
              const FLOOR_HEIGHT = 3.2;
              const ffFloor = Math.round(z / FLOOR_HEIGHT);
              const floorLabel = ffFloor === -1 ? "B1" : ffFloor === 0 ? "G" : `F${ffFloor}`;

              return (
                <div
                  key={ff.firefighter.id}
                  className={`firefighter-list-item ${isSelected ? "selected" : ""} ${itemClass}`}
                  onClick={() => setSelectedId(ff.firefighter.id)}
                >
                  <div className="ff-header">
                    <span className="ff-name">{ff.firefighter.name}</span>
                    <span className="ff-floor">{floorLabel}</span>
                  </div>
                  {(ff.firefighter.rank || ff.firefighter.role) && (
                    <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>
                      {ff.firefighter.rank && <span>{ff.firefighter.rank}</span>}
                      {ff.firefighter.rank && ff.firefighter.role && <span> • </span>}
                      {ff.firefighter.role && <span>{ff.firefighter.role}</span>}
                    </div>
                  )}
                  <div className="ff-stats">
                    <span className="ff-heart">❤️ {heartRate ?? "--"}</span>
                    <span className="ff-state">{isManDown ? "MAN DOWN" : (ff.vitals?.motion_state ?? "--")}</span>
                  </div>
                  <div className="ff-scba">
                    🛡️ {ff.scba?.cylinder_pressure_bar?.toFixed(0) ?? "--"} bar
                    <span className="scba-time">
                      (⏳ {ff.scba?.cylinder_pressure_bar ? Math.round(ff.scba.cylinder_pressure_bar * 0.15) : "--"} min)
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>

    {/* 3D Scene */}
    <Canvas camera={{ position: cameraState.current?.position ?? [20, 30, 40], fov: 50, up: [0, 0, 1] }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[-10, 20, 10]} intensity={0.8} />
      <Building
        firefighters={firefighters}
        onSelect={setSelectedId}
        selectedId={selectedId}
        config={config}
        selectedFloor={selectedFloor}
        footprint={footprint}
        levels={buildingLevels}
      />
      <OrbitControls 
        ref={controlsRef} 
        enablePan enableZoom enableRotate maxPolarAngle={Math.PI / 2} 
      />
      <CameraHandler controlsRef={controlsRef} initialTarget={cameraState.current?.target} />
    </Canvas>

    {/* Firefighter details panel */}
    {selected && (
      <div className="info-panel">
        <h2>{selected.firefighter.name}</h2>
        <p>
          <strong>ID:</strong> <span>{selected.firefighter.id}</span>
        </p>
        {selected.firefighter.rank && (
          <p>
            <strong>Rank:</strong> <span>{selected.firefighter.rank}</span>
          </p>
        )}
        {selected.firefighter.role && (
          <p>
            <strong>Role:</strong> <span>{selected.firefighter.role}</span>
          </p>
        )}
        <p>
          <strong>Pos:</strong>{" "}
          <span>
            {selected.x?.toFixed(1) ?? selected.position?.x?.toFixed(1)},{" "}
            {selected.y?.toFixed(1) ?? selected.position?.y?.toFixed(1)},{" "}
            {selected.z?.toFixed(1) ?? selected.position?.z?.toFixed(1)}
          </span>
        </p>
        <p>
          <strong>Heart Rate:</strong> <span>{selected.vitals?.heart_rate_bpm} bpm</span>
        </p>
        {/* Hide normal state if Man Down */}
        {!((selected.vitals?.heart_rate_bpm > 120 || selected.vitals?.heart_rate_bpm < 40) || (Date.now() - (selected.lastMoveTime ?? Date.now()) > 30000)) && (
          <p>
            <strong>State:</strong> <span>{selected.vitals?.motion_state}</span>
          </p>
        )}
        <p>
          <strong>SCBA:</strong>{" "}
          <span>
            {selected.scba?.cylinder_pressure_bar?.toFixed(0) ?? "N/A"} bar
            <span style={{ color: "#aaa", marginLeft: "8px", fontSize: "0.9em" }}>
              (⏳ {selected.scba?.cylinder_pressure_bar ? Math.round(selected.scba.cylinder_pressure_bar * 0.15) : "--"} min)
            </span>
          </span>
        </p>
        {/* Status Indicators */}
        {((selected.vitals?.heart_rate_bpm > 120 || selected.vitals?.heart_rate_bpm < 40) || (Date.now() - (selected.lastMoveTime ?? Date.now()) > 30000)) && (
             <p style={{ color: "#ff4757", fontWeight: "bold", margin: "5px 0" }}>🚨 MAN DOWN / CRITICAL</p>
        )}
        <button onClick={() => setSelectedId(null)}>Close</button>
      </div>
    )}

    {/* Pretty buttons at bottom-right */}
    <div
      style={{
        position: "fixed",
        bottom: 250,
        right: 20,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <button
        className="primary-btn"
        style={{
          padding: "10px 16px",
          fontSize: "1rem",
          borderRadius: "8px",
          background: "linear-gradient(90deg, #ff6b6b, #ff8787)",
          border: "none",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
          transition: "transform 0.1s ease, box-shadow 0.1s ease",
        }}
        onClick={handleExportCsv}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 10px rgba(0,0,0,0.25)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
        }}
      >
        Export CSV
      </button>

      <button
        className="primary-btn"
        style={{
          padding: "10px 16px",
          fontSize: "1rem",
          borderRadius: "8px",
          background: "linear-gradient(90deg, #54a0ff, #70c1ff)",
          border: "none",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
          transition: "transform 0.1s ease, box-shadow 0.1s ease",
        }}
        onClick={() => {
          if (controlsRef.current) {
            const pos = controlsRef.current.object.position;
            const target = controlsRef.current.target;
            cameraState.current = {
              position: [pos.x, pos.y, pos.z],
              target: [target.x, target.y, target.z],
            };
          }
          setView("movement");
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 10px rgba(0,0,0,0.25)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
        }}
      >
        Open Movement
      </button>
    </div>
  </div>
);

}
