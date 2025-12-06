import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";

const FLOOR_SIZE = 10;
const FLOOR_HEIGHT = 4;

export default function Firefighter({
  id,
  floor,
  onSelect
}: {
  id: string;
  floor: number;
  onSelect: (data: any) => void;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  // Random velocity
  const vel = useRef(
    new THREE.Vector3(
      (Math.random() - 0.5) * 0.02,
      0,
      (Math.random() - 0.5) * 0.02
    )
  );

  // Initial position
  const [position] = useState(() => [
    (Math.random() - 0.5) * FLOOR_SIZE,
    floor * FLOOR_HEIGHT + 0.2,
    (Math.random() - 0.5) * FLOOR_SIZE
  ] as [number, number, number]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.add(vel.current);

    // Bounce on edges
    if (Math.abs(ref.current.position.x) > FLOOR_SIZE / 2)
      vel.current.x *= -1;
    if (Math.abs(ref.current.position.z) > FLOOR_SIZE / 2)
      vel.current.z *= -1;
  });

  const handleClick = () => {
    onSelect({
      id,
      heartRate: Math.floor(70 + Math.random() * 30),
      temp: (36 + Math.random() * 2).toFixed(1),
      oxygen: Math.floor(80 + Math.random() * 20)
    });
  };

  return (
    <mesh
      ref={ref}
      onClick={handleClick}
      position={position}
    >
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}
