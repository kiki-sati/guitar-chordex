import { scaleDefs } from './constants';
import type { PitchClass, RootIndex, ScaleType } from './types';

/** scaleDefs[type].map(s=>(root+s)%12). (원본 라인 390) */
export function scaleNotes(root: RootIndex, type: ScaleType): PitchClass[] {
  return scaleDefs[type].map((s) => (root + s) % 12);
}
