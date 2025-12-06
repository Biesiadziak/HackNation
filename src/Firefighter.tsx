import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export default function Firefighter({
  data,
  onSelect,
  config
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
}) {
  const ref = useRef<THREE.Mesh>(null!);

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

  // Smoothly interpolate position
  useFrame(() => {
    if (ref.current) {
      ref.current.position.lerp(new THREE.Vector3(x, y, z), 0.1);
    }
  });

  return (
    <mesh
      ref={ref}
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}
