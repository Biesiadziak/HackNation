import { GroupProps } from "@react-three/fiber";
import Firefighter from "./Firefighter";

const FLOOR_SIZE = 50;
const FLOOR_HEIGHT = 3.5;

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
}

export default function Building({ onSelect, firefighters, config }: BuildingProps) {
  const floors = [0, 1, 2];

  return (
    <group>
      {floors.map((i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, i * FLOOR_HEIGHT, 0]}
        >
          <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
          <meshStandardMaterial 
            color="#d2b48c" 
            side={2} 
            transparent={true} 
            opacity={0.5} 
          />
          <gridHelper args={[FLOOR_SIZE, 10]} rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0.1]} />
        </mesh>
      ))}

      {Object.values(firefighters).map((ff) => (
        <Firefighter
          key={ff.firefighter.id}
          data={ff}
          onSelect={() => onSelect(ff.firefighter.id)}
          config={config}
        />
      ))}
    </group>
  );
}
