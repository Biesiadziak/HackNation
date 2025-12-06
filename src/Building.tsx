import { GroupProps, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import Firefighter from "./Firefighter";

const FLOOR_SIZE = 50;
const FLOOR_HEIGHT = 3.2;
const FIREFIGHTER_Z_OFFSET = 1.2; // How high above the floor firefighters appear

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
}

export default function Building({ onSelect, firefighters, config, selectedFloor }: BuildingProps) {
  const floors = [-1, 0, 1, 2];

  // Calculate floor position based on selection
  const getFloorZ = (floorNum: number) => {
    if (selectedFloor === null) {
      // Overview mode - normal stacking
      return floorNum * FLOOR_HEIGHT;
    }
    // Focused mode - selected floor at base, upper floors spread out
    if (floorNum < selectedFloor) {
      // Lower floors stay in place but hidden
      return floorNum * FLOOR_HEIGHT - 20;
    } else if (floorNum === selectedFloor) {
      // Selected floor at center
      return 0;
    } else {
      // Upper floors move up with extra spacing
      return (floorNum - selectedFloor) * (FLOOR_HEIGHT + 8);
    }
  };

  const getFloorOpacity = (floorNum: number) => {
    if (selectedFloor === null) return 0.5;
    if (floorNum === selectedFloor) return 0.7;
    if (floorNum < selectedFloor) return 0.1;
    return 0.3;
  };

  return (
    <group>
      {floors.map((i) => (
        <AnimatedFloor
          key={i}
          floorNum={i}
          targetZ={getFloorZ(i)}
          opacity={getFloorOpacity(i)}
          isSelected={i === selectedFloor}
        />
      ))}

      {Object.values(firefighters).map((ff) => (
        <Firefighter
          key={ff.firefighter.id}
          data={ff}
          onSelect={() => onSelect(ff.firefighter.id)}
          config={config}
          selectedFloor={selectedFloor}
          getFloorZ={getFloorZ}
          zOffset={FIREFIGHTER_Z_OFFSET}
        />
      ))}
    </group>
  );
}

// Animated floor component for smooth transitions
function AnimatedFloor({ 
  floorNum, 
  targetZ, 
  opacity, 
  isSelected 
}: { 
  floorNum: number; 
  targetZ: number; 
  opacity: number; 
  isSelected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const textRef = useRef<THREE.Mesh>(null!);
  const currentOpacity = useRef(opacity);

  useFrame((_, delta) => {
    if (meshRef.current) {
      // Smooth position interpolation
      meshRef.current.position.z = THREE.MathUtils.lerp(
        meshRef.current.position.z,
        targetZ,
        delta * 3
      );
      // Smooth opacity interpolation
      currentOpacity.current = THREE.MathUtils.lerp(
        currentOpacity.current,
        opacity,
        delta * 5
      );
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity = currentOpacity.current;
    }
    if (textRef.current) {
      textRef.current.position.z = meshRef.current.position.z + 0.1;
    }
  });

  const floorLabel = floorNum === -1 ? "B1" : floorNum === 0 ? "G" : `F${floorNum}`;

  return (
    <group>
      <mesh
        ref={meshRef}
        rotation={[0, 0, 0]}
        // center floors at origin so movement viewer and main view align
        position={[0, 0, targetZ]}
      >
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial 
          color={isSelected ? "#ffcc80" : "#d4c4a8"}
          side={2} 
          transparent={true} 
          opacity={opacity}
        />
      </mesh>
      {/* Floor grid lines */}
      <gridHelper 
        args={[FLOOR_SIZE, 10, "#ffffff", "#888888"]} 
        // center the grid at origin on the floor plane
        position={[0, 0, targetZ + 0.05]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      {/* Floor label */}
      <Text
        ref={textRef}
        // keep label offset relative to floor center
        position={[-3, -12, targetZ + 0.1]}
        fontSize={3}
        color={isSelected ? "#ffa502" : "#888888"}
        anchorX="center"
        anchorY="middle"
      >
        {floorLabel}
      </Text>
    </group>
  );
}