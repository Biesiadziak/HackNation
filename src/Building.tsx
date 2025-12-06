import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import Firefighter from "./Firefighter";

const FLOOR_SIZE = 50;
const FLOOR_HEIGHT = 3.2;
const FIREFIGHTER_Z_OFFSET = 1.2;

interface BuildingProps {
  onSelect: (id: string) => void;
  firefighters: Record<string, any>;
  config: {
    scale: number;
    swapYZ: boolean;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
  };
  selectedFloor: number | null;
  focusedFloors?: number[];
  footprint?: [number, number][];
  levels?: number;
  selectedId?: string | null;
  staticFloors?: boolean; // New prop
}

export default function Building({
  onSelect,
  firefighters,
  config,
  selectedFloor,
  focusedFloors,
  footprint,
  levels = 3,
  selectedId,
  staticFloors = false,
}: BuildingProps) {
  const floors = useMemo(() => {
    const f = [-1, 0];
    for (let i = 1; i < levels; i++) f.push(i);
    return f;
  }, [levels]);

  const getFloorZ = (floorNum: number) => {
    if (focusedFloors && focusedFloors.length > 0) {
      const avg = focusedFloors.reduce((s, v) => s + v, 0) / focusedFloors.length;
      const spread = 3.0;
      const offset = (floorNum - avg) * spread;
      if (focusedFloors.includes(floorNum)) return floorNum * FLOOR_HEIGHT + offset;
      const minF = Math.min(...focusedFloors);
      const maxF = Math.max(...focusedFloors);
      if (floorNum < minF) return floorNum * FLOOR_HEIGHT - 8;
      if (floorNum > maxF) return floorNum * FLOOR_HEIGHT + 8;
      return floorNum * FLOOR_HEIGHT;
    }
    if (selectedFloor === null) return floorNum * FLOOR_HEIGHT;
    if (floorNum > selectedFloor) return floorNum * FLOOR_HEIGHT + 20;
    return floorNum * FLOOR_HEIGHT;
  };

  const getFloorOpacity = (floorNum: number) => {
    if (selectedFloor === null) return 0.5;
    if (floorNum === selectedFloor) return 0.7;
    if (floorNum < selectedFloor) return 0.1;
    return 0.3;
  };

  return (
    <group>
      {floors.map((i) =>
        staticFloors ? (
          <StaticFloor
            key={i}
            floorNum={i}
            z={getFloorZ(i)}
            opacity={getFloorOpacity(i)}
            isSelected={i === selectedFloor}
            footprint={footprint}
          />
        ) : (
          <AnimatedFloor
            key={i}
            floorNum={i}
            targetZ={getFloorZ(i)}
            opacity={getFloorOpacity(i)}
            isSelected={i === selectedFloor}
            footprint={footprint}
          />
        )
      )}

      {Object.values(firefighters).map((ff) => (
        <Firefighter
          key={ff.firefighter.id}
          data={ff}
          onSelect={() => onSelect(ff.firefighter.id)}
          isSelected={selectedId === ff.firefighter.id}
          config={config}
          selectedFloor={selectedFloor}
          getFloorZ={getFloorZ}
          zOffset={FIREFIGHTER_Z_OFFSET}
        />
      ))}
    </group>
  );
}

// ----------------- AnimatedFloor -----------------
function AnimatedFloor({
  floorNum,
  targetZ,
  opacity,
  isSelected,
  footprint,
}: {
  floorNum: number;
  targetZ: number;
  opacity: number;
  isSelected: boolean;
  footprint?: [number, number][];
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textRef = useRef<THREE.Mesh>(null!);
  const currentOpacity = useRef(opacity);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, delta * 3);
      currentOpacity.current = THREE.MathUtils.lerp(currentOpacity.current, opacity, delta * 5);
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity = currentOpacity.current;
    }
    if (textRef.current) textRef.current.position.z = meshRef.current.position.z + 0.1;
  });

  return <FloorMesh floorNum={floorNum} z={targetZ} opacity={opacity} isSelected={isSelected} footprint={footprint} />;
}

// ----------------- StaticFloor -----------------
function StaticFloor({
  floorNum,
  z,
  opacity,
  isSelected,
  footprint,
}: {
  floorNum: number;
  z: number;
  opacity: number;
  isSelected: boolean;
  footprint?: [number, number][];
}) {
  return <FloorMesh floorNum={floorNum} z={z} opacity={opacity} isSelected={isSelected} footprint={footprint} />;
}

// ----------------- Shared FloorMesh -----------------
function FloorMesh({
  floorNum,
  z,
  opacity,
  isSelected,
  footprint,
}: {
  floorNum: number;
  z: number;
  opacity: number;
  isSelected: boolean;
  footprint?: [number, number][];
}) {
  const geometry = useMemo(() => {
    if (footprint && footprint.length > 0) {
      const shape = new THREE.Shape();
      shape.moveTo(footprint[0][0], footprint[0][1]);
      footprint.slice(1).forEach((p) => shape.lineTo(p[0], p[1]));
      return new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    }
    return new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  }, [footprint]);

  const floorLabel = floorNum === -1 ? "B1" : floorNum === 0 ? "G" : `F${floorNum}`;

  return (
    <group>
      <mesh rotation={[0, 0, 0]} position={[20, 10, z]} geometry={geometry} scale={footprint ? [3, 3, 1] : [1, 1, 1]}>
        <meshStandardMaterial
          color={isSelected ? "#ffcc80" : "#d4c4a8"}
          side={2}
          transparent
          opacity={opacity}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {!footprint && (
        <gridHelper args={[FLOOR_SIZE, 10, "#ffffff", "#888888"]} position={[20, 10, z + 0.05]} rotation={[Math.PI / 2, 0, 0]} />
      )}

      <Text position={[-3, -12, z + 0.1]} fontSize={3} color={isSelected ? "#ffa502" : "#888888"} anchorX="center" anchorY="middle">
        {floorLabel}
      </Text>
    </group>
  );
}
