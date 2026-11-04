import { LngLatBounds } from 'maplibre-gl';
import type { Coordinate } from './types';

export const boundsFromFeatures = (features: any[]) => {
  const positions: Coordinate[] = [];
  const collectPositions = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      positions.push([value[0], value[1]]);
      return;
    }
    value.forEach(collectPositions);
  };

  for (const feature of features) collectPositions(feature.geometry?.coordinates);
  if (!positions.length) return null;

  return positions.reduce(
    (bounds, position) => bounds.extend(position),
    new LngLatBounds(positions[0], positions[0]),
  );
};

export const mergeBounds = (current: LngLatBounds | null, next: LngLatBounds | null) => {
  if (!current) return next;
  if (!next) return current;
  return current.extend(next.getSouthWest()).extend(next.getNorthEast());
};
