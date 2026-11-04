import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import {
  MARKER_HIDE_ZOOM,
  MARKER_ICON_ONLY_ZOOM,
  MARKER_STACK_OFFSET,
} from './constants';
import type { CoverageAreas } from './coverage-areas';
import type { App, Coverage } from './types';
import type { Viewport } from './viewport';

export const createMapMarkers = (options: {
  root: HTMLElement;
  map: MapLibreMap;
  appById: Map<string, App>;
  coverages: Coverage[];
  coverageAreas: CoverageAreas;
  viewport: Viewport;
  onSelect: (appId: string) => void;
}) => {
  const { root, map, appById, coverages, coverageAreas, viewport, onSelect } = options;

  const markerElements = Array.from(
    root.querySelectorAll<HTMLElement>('[data-map-marker]'),
  );
  /** Markers that share a position are stacked vertically so none is hidden. */
  const markerStackIndex = new Map<string, number>();
  for (const element of markerElements) {
    const app = appById.get(element.dataset.appId ?? '');
    if (!app?.marker) {
      element.hidden = true;
      continue;
    }
    const [lon, lat] = app.marker.coordinates;
    const stackKey = `${lon.toFixed(4)},${lat.toFixed(4)}`;
    const stackIndex = markerStackIndex.get(stackKey) ?? 0;
    markerStackIndex.set(stackKey, stackIndex + 1);
    new Marker({
      element,
      anchor: 'bottom',
      offset: [0, -stackIndex * MARKER_STACK_OFFSET],
    })
      .setLngLat(app.marker.coordinates)
      .addTo(map);
    element.addEventListener('click', (event) => {
      // Markers live inside MapLibre's canvas container, so without this the
      // click would bubble up and also fire a map click on whatever area sits
      // under the marker, opening the wrong app.
      event.stopPropagation();
      onSelect(app.id);
      const coverage = coverages.find((entry) => entry.app_id === app.id);
      const bounds = coverage ? coverageAreas.boundsFor(coverage.id) : undefined;
      if (bounds) viewport.centerOn(bounds);
    });
  }

  const update = () => {
    const zoom = map.getZoom();
    for (const element of markerElements) {
      if (!appById.get(element.dataset.appId ?? '')?.marker) continue;
      if (zoom < MARKER_HIDE_ZOOM) {
        element.hidden = true;
        continue;
      }
      element.hidden = false;
      const showLabel = zoom >= MARKER_ICON_ONLY_ZOOM;
      if (showLabel && !element.hasAttribute('label')) {
        const app = appById.get(element.dataset.appId ?? '');
        element.setAttribute('label', app?.marker?.label ?? app?.name ?? '');
      } else if (!showLabel && element.hasAttribute('label')) {
        element.removeAttribute('label');
      }
    }
  };

  map.on('zoom', update);
  map.on('load', update);

  return { update };
};
