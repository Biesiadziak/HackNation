import { GroupProps } from "@react-three/fiber";
import Firefighter from "./Firefighter";

const FLOOR_SIZE = 10;
const FLOOR_HEIGHT = 4;

export default function Building({ onSelect }: { onSelect: (d: any) => void }) {
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
          <meshStandardMaterial color="#d2b48c" side={2} />
        </mesh>
      ))}

      {floors.map((i) =>
        [...Array(6)].map((_, j) => (
          <Firefighter
            key={`ff-${i}-${j}`}
            floor={i}
            id={`${i}-${j}`}
            onSelect={onSelect}
          />
        ))
      )}
    </group>
  );
}
