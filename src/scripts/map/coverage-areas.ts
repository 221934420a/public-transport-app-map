import type { GeoJSONSource, LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import { boundsFromFeatures, mergeBounds } from './bounds';
import {
  AREA_FILL_LAYER_ID,
  AREA_FLUSH_INTERVAL,
  AREA_OUTLINE_LAYER_ID,
  AREA_SOURCE_ID,
  GEOMETRY_CONCURRENCY,
  MARKER_LAYER_ID,
} from './constants';
import { fetchGeometry } from './geometry';
import type { Coverage, MapShell } from './types';
import type { Viewport } from './viewport';

export const createCoverageAreas = (options: {
  map: MapLibreMap;
  theme: MapShell['theme'];
  overview: MapShell['overview'];
  viewport: Viewport;
  onSelect: (appId: string, coverageId?: string) => void;
}) => {
  const { map, theme, overview, viewport, onSelect } = options;

  /** Drawn bounds of each base area, so an app marker can focus the same range. */
  const boundsById = new Map<string, LngLatBounds>();
  let areaBounds: LngLatBounds | null = null;

  /**
   * Copy each feature before adding the style the paint expressions read:
   * geometry files are cached and shared between coverage records, so mutating
   * a feature in place would leak one area's style into another.
   */
  const decorate = (coverage: Coverage, features: any[]) => {
    const style = coverage.style ?? {};
    const decoration = {
      areaFillColor: style.fill_color ?? theme.accent,
      areaFillOpacity: style.fill_opacity ?? overview.fill_opacity,
      areaOutlineColor: style.outline_color ?? theme.outline,
      areaOutlineWidth: style.outline_width ?? overview.outline_width,
      coverageId: coverage.id,
      appId: coverage.app_id,
      areaSort: coverage.sort_order ?? 0,
    };
    return features.map((feature) => ({
      ...feature,
      properties: { ...(feature.properties ?? {}), ...decoration },
    }));
  };

  const addLayers = () => {
    map.addSource(AREA_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] as any[] },
    });
    map.addLayer({
      id: AREA_FILL_LAYER_ID,
      type: 'fill',
      source: AREA_SOURCE_ID,
      paint: {
        'fill-color': ['get', 'areaFillColor'],
        'fill-opacity': ['get', 'areaFillOpacity'],
      },
    });
    map.addLayer({
      id: AREA_OUTLINE_LAYER_ID,
      type: 'line',
      source: AREA_SOURCE_ID,
      paint: {
        'line-color': ['get', 'areaOutlineColor'],
        'line-width': ['get', 'areaOutlineWidth'],
      },
    });

    map.on('click', AREA_FILL_LAYER_ID, (event) => {
      // An app marker sits on top of the areas and wins the click. Stacked
      // markers have a layer each, named after the first one.
      const markerLayers = (map.getStyle().layers ?? [])
        .map((layer) => layer.id)
        .filter((id) => id === MARKER_LAYER_ID || id.startsWith(`${MARKER_LAYER_ID}-`));
      if (
        markerLayers.length &&
        map.queryRenderedFeatures(event.point, { layers: markerLayers }).length
      ) {
        return;
      }
      const features = event.features ?? [];
      if (!features.length) return;
      // Areas are drawn in sort_order, so the last drawn one is on top and
      // should win the click where areas overlap.
      const top = features.reduce((best, feature) =>
        Number(feature.properties?.areaSort ?? 0) >= Number(best.properties?.areaSort ?? 0)
          ? feature
          : best,
      );
      const coverageId = String(top.properties?.coverageId ?? '');
      onSelect(String(top.properties?.appId ?? ''), coverageId || undefined);
      const bounds = boundsById.get(coverageId);
      if (bounds) viewport.centerOn(bounds);
    });
    map.on('mouseenter', AREA_FILL_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', AREA_FILL_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
  };

  const load = async (coverages: Coverage[]) => {
    const source = map.getSource(AREA_SOURCE_ID) as GeoJSONSource;
    const loaded: any[] = [];

    // Fetches finish out of order, but features must reach the source in
    // sort_order, so completed areas wait until every earlier one is done.
    const pending: ({ coverage: Coverage; features: any[] } | null)[] = coverages.map(
      () => null,
    );
    let next = 0;
    let flushTimer: number | null = null;

    const flush = () => {
      flushTimer = null;
      source.setData({ type: 'FeatureCollection', features: loaded });
    };

    // Areas are pushed to the map in batches so they appear while later
    // files are still downloading without re-uploading geometry per area.
    const drain = () => {
      let appended = false;
      while (next < pending.length && pending[next]) {
        const entry = pending[next]!;
        pending[next] = null;
        next += 1;
        if (!entry.features.length) continue;
        loaded.push(...entry.features);
        const bounds = boundsFromFeatures(entry.features);
        if (bounds) {
          boundsById.set(entry.coverage.id, bounds);
          areaBounds = mergeBounds(areaBounds, bounds);
        }
        appended = true;
      }
      if (appended && flushTimer === null) {
        flushTimer = window.setTimeout(flush, AREA_FLUSH_INTERVAL);
      }
    };

    let cursor = 0;
    const loadOne = async () => {
      while (cursor < coverages.length) {
        const index = cursor;
        cursor += 1;
        const coverage = coverages[index];
        const groups = await Promise.all(
          coverage.geometry_refs.map((ref) => fetchGeometry(ref).catch(() => [] as any[])),
        );
        pending[index] = { coverage, features: decorate(coverage, groups.flat()) };
        drain();
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(GEOMETRY_CONCURRENCY, coverages.length) }, loadOne),
    );

    if (flushTimer !== null) window.clearTimeout(flushTimer);
    flush();
  };

  return {
    addLayers,
    load,
    boundsFor: (coverageId: string) => boundsById.get(coverageId),
    focusOverview: (withPanel: boolean) => viewport.focusBounds(withPanel, areaBounds),
  };
};

export type CoverageAreas = ReturnType<typeof createCoverageAreas>;
