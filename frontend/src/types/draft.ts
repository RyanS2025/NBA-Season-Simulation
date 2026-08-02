export interface DraftProspect {
  id: string;
  name: string;
  position: string;
  age: number;
  school: string;
  projectedOverall: [number, number]; // [low, high] range
  ceiling: number;
  floor: number;
  strengths: string[];
  weaknesses: string[];
  comparison: string;
  scoutingLevel: number; // 0-3
  storyline?: string;
}
