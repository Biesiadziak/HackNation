import { useRef, useState } from "react";
import * as THREE from "three";
import { registerFirefighter, recordPosition } from "./state/firefighters";
import { useFrame, useLoader } from "@react-three/fiber";

export default function Firefighter({
  data,
  onSelect,
  config,
  selectedFloor,
  getFloorZ,
  zOffset = 1.2,
  isSelected = false
}: {
  data: any;
  onSelect: () => void;
  config: {
    scale: number;
    swapYZ: boolean;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
  };
  selectedFloor: number | null;
  getFloorZ: (floor: number) => number;
  zOffset?: number;
  isSelected?: boolean;
}) {
  const ref = useRef<THREE.Sprite>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  // Load the texture
  const texture = useLoader(THREE.TextureLoader, '/firefighter_icon.png');

  // Raw data
  const rawX = typeof data.x === 'number' ? data.x : (data.position?.x ?? 0);
  const rawY = typeof data.y === 'number' ? data.y : (data.position?.y ?? 0);
  const rawZ = typeof data.z === 'number' ? data.z : (data.position?.z ?? 0);

  // Apply calibration
  let x = rawX * config.scale;
  let y = rawY * config.scale;
  let z = rawZ * config.scale;

  if (config.swapYZ) {
    // If input is Z-up:
    // Input X -> 3D X
    // Input Y -> 3D Z (Depth)
    // Input Z -> 3D Y (Height)
    const tempY = y;
    y = z;
    z = tempY;
  }

  x += config.offsetX;
  y += config.offsetY;
  z += config.offsetZ;

  // When a floor is selected, adjust Z based on firefighter's floor
  // Determine firefighter's floor based on Z position
  const FLOOR_HEIGHT = 3.2;
  const firefighterFloor = Math.round(z / FLOOR_HEIGHT);
  const baseZ = selectedFloor !== null 
    ? getFloorZ(firefighterFloor) + (z - firefighterFloor * FLOOR_HEIGHT) 
    : z;
  // Add offset so firefighter appears above the floor, not inside it
  const adjustedZ = baseZ + zOffset;

  // Man Down Logic
  const heartRate = data.vitals?.heart_rate_bpm;
  const isCriticalHR = heartRate > 120 || heartRate < 40;
  const timeSinceMove = Date.now() - (data.lastMoveTime ?? Date.now());
  const isStationary = timeSinceMove > 30000;
  const isManDown = isCriticalHR || isStationary;
  
  let iconColor = "#ffffff";
  
  if (isManDown) {
      iconColor = "#ff4757"; // Red for Man Down
  }

  // Visibility logic:
  // 1. If a specific floor is selected, fade out firefighters on other floors
  // 2. If not selected, show all
  const isRelevantFloor = selectedFloor === null || firefighterFloor === selectedFloor;
  const opacity = isRelevantFloor ? 1.0 : 0.1;
  
  // If not on relevant floor and not selected, maybe hide completely or keep very faint?
  // Let's keep them faint so we know they exist.
  
  // Smoothly interpolate position with delta-time based lerp
  useFrame((state, delta) => {
    if (ref.current) {
      const targetPos = new THREE.Vector3(x, y, adjustedZ);
      ref.current.position.lerp(targetPos, 1 - Math.pow(0.001, delta));
      
      // Update opacity
      ref.current.material.opacity = THREE.MathUtils.lerp(
        ref.current.material.opacity,
        opacity,
        delta * 5
      );
    }
    // Animate hover ring - make it face the camera (billboard effect)
    if (ringRef.current) {
      ringRef.current.position.set(
        ref.current?.position.x ?? x,
        ref.current?.position.y ?? y,
        ref.current?.position.z ?? adjustedZ
      );
      // Make ring face the camera
      ringRef.current.quaternion.copy(state.camera.quaternion);
      // Pulse animation when hovered
      if (hovered) {
        const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.1;
        ringRef.current.scale.setScalar(pulse);
      }
      
      // Update ring opacity
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.8 : (opacity * 0.5);
    }
  });

  return (
    <group>
      {/* Selection ring - billboarded to face camera */}
      <mesh
        ref={ringRef}
        renderOrder={998}
        position={[x, y, adjustedZ]}
        visible={hovered || isSelected}
      >
        <ringGeometry args={[1.4, 1.8, 32]} />
        <meshBasicMaterial 
          color={isSelected ? "#00ff00" : "#ffa502"} 
          transparent 
          opacity={0.8}
          side={THREE.DoubleSide}
          depthTest={true} // Enable depth test so it doesn't shine through walls
        />
      </mesh>

      <sprite
        ref={ref}
        renderOrder={999}
        position={[x, y, adjustedZ]}
        scale={hovered ? [3, 3, 1] : [2.5, 2.5, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <spriteMaterial 
          map={texture} 
          color={iconColor}
          transparent 
          opacity={opacity}
          depthTest={true} // Enable depth test so it doesn't shine through walls
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}
