import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useState } from "react";
import Building from "./Building";
import "./index.css";
import { getSnapshot, resetStore } from "./state/firefighters";
import { exportPerFirefighter } from "./utils/exportData";

export default function App() {
  const [selected, setSelected] = useState<any>(null);

  // Automatic export on visibilitychange was removed by user request.

  return (
    <div className="app-container">
      <h1 className="app-title">3D Firefighter Localization</h1>

      {/* --- 3D Scene --- */}
      <Canvas camera={{ position: [10, 12, 16], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[-10, 20, -10]} intensity={0.5} />
        
        <Building onSelect={setSelected} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} maxPolarAngle={Math.PI / 2} />
      </Canvas>

      {/* --- UI Panel for firefighter vitals --- */}
      {selected && (
        <div className="info-panel">
          <h2>Firefighter #{selected.id}</h2>
          <p><strong>Heart Rate:</strong> <span>{selected.heartRate} bpm</span></p>
          <p><strong>Temperature:</strong> <span>{selected.temp} °C</span></p>
          <p><strong>O₂ Level:</strong> <span>{selected.oxygen}%</span></p>
          <button onClick={() => setSelected(null)}>Close</button>
        </div>
      )}

      <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 999 }}>
        <button onClick={async () => {
          const snap = getSnapshot();
          await exportPerFirefighter(snap);
          // optional: clear after export
          // resetStore();
        }}>Export CSV</button>
      </div>
    </div>
  );
}
