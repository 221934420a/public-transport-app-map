import type { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import { boundsFromFeatures } from './bounds';
import {
  TICKET_FILL_LAYER_ID,
  TICKET_OUTLINE_LAYER_ID,
  TICKET_SOURCE_ID,
} from './constants';
import { fetchGeometry } from './geometry';
import type { AreaStyle, Coverage, MapShell, Ticket } from './types';

const emptyCollection = () => ({
  type: 'FeatureCollection' as const,
  features: [] as unknown[],
});

export const createTicketOverlay = (options: {
  map: MapLibreMap;
  theme: MapShell['theme'];
  overview: MapShell['overview'];
  centerOn: (bounds: LngLatBounds) => void;
}) => {
  const { map, theme, overview, centerOn } = options;
  let areaAdded = false;
  let activeTicketId: string | null = null;

  const ensureArea = (style: AreaStyle) => {
    const fillColor = style.fill_color ?? theme.accent;
    const fillOpacity = style.fill_opacity ?? 0.35;
    const outlineColor = style.outline_color ?? theme.outline;
    const outlineWidth = style.outline_width ?? overview.outline_width;

    if (areaAdded) {
      map.setPaintProperty(TICKET_FILL_LAYER_ID, 'fill-color', fillColor);
      map.setPaintProperty(TICKET_FILL_LAYER_ID, 'fill-opacity', fillOpacity);
      map.setPaintProperty(TICKET_OUTLINE_LAYER_ID, 'line-color', outlineColor);
      map.setPaintProperty(TICKET_OUTLINE_LAYER_ID, 'line-width', outlineWidth);
      return;
    }

    map.addSource(TICKET_SOURCE_ID, { type: 'geojson', data: emptyCollection() });
    map.addLayer({
      id: TICKET_FILL_LAYER_ID,
      type: 'fill',
      source: TICKET_SOURCE_ID,
      paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity },
    });
    map.addLayer({
      id: TICKET_OUTLINE_LAYER_ID,
      type: 'line',
      source: TICKET_SOURCE_ID,
      paint: { 'line-color': outlineColor, 'line-width': outlineWidth },
    });
    areaAdded = true;
  };

  const setArea = (features: any[], style: AreaStyle) => {
    ensureArea(style);
    const source = map.getSource(TICKET_SOURCE_ID) as
      | { setData?: (data: unknown) => void }
      | undefined;
    source?.setData?.({ type: 'FeatureCollection', features });
    const bounds = boundsFromFeatures(features);
    if (bounds) centerOn(bounds);
  };

  const clear = () => {
    activeTicketId = null;
    if (!areaAdded) return;
    const source = map.getSource(TICKET_SOURCE_ID) as
      | { setData?: (data: unknown) => void }
      | undefined;
    source?.setData?.(emptyCollection());
  };

  const show = async (ticket: Ticket, coverages: Coverage[]) => {
    activeTicketId = ticket.id;
    try {
      const groups = await Promise.all(
        coverages.flatMap((coverage) =>
          coverage.geometry_refs.map((ref) =>
            fetchGeometry(ref).catch(() => [] as any[]),
          ),
        ),
      );
      const features = groups.flat();
      if (activeTicketId !== ticket.id) return;
      setArea(features, coverages[0]?.style ?? {});
    } catch {
      clear();
    }
  };

  return { show, clear };
};

export type TicketOverlay = ReturnType<typeof createTicketOverlay>;
