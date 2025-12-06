import "./index.css";

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1 className="landing-title">Firefighter Command Center</h1>
        <p className="landing-subtitle">Real-time 3D Localization & Telemetry System</p>
        
        <div className="landing-features">
          <div className="feature-card">
            <h3>Real-time Tracking</h3>
            <p>Monitor firefighter positions in 3D space instantly.</p>
          </div>
          <div className="feature-card">
            <h3>Vital Signs</h3>
            <p>Live heart rate, motion state, and SCBA pressure data.</p>
          </div>
          <div className="feature-card">
            <h3>Building Layout</h3>
            <p>Multi-floor visualization for complex environments.</p>
          </div>
        </div>

        <button className="start-button" onClick={onStart}>
          Start Visualization
        </button>
      </div>
    </div>
  );
}
