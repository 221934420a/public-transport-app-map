import type { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';

export type Viewport = {
  centerOn: (bounds: LngLatBounds) => void;
  focusBounds: (withPanel: boolean, bounds: LngLatBounds | null) => void;
};

export const bindZoomControls = (
  map: MapLibreMap,
  zoomInButton: HTMLElementTagNameMap['md-icon-button'] | null,
  zoomOutButton: HTMLElementTagNameMap['md-icon-button'] | null,
) => {
  const update = () => {
    if (zoomInButton) zoomInButton.disabled = map.getZoom() >= map.getMaxZoom();
    if (zoomOutButton) zoomOutButton.disabled = map.getZoom() <= map.getMinZoom();
  };

  zoomInButton?.addEventListener('click', () => map.zoomIn());
  zoomOutButton?.addEventListener('click', () => map.zoomOut());
  map.on('zoom', update);
  map.on('load', update);
  update();
};

export const createViewport = (map: MapLibreMap, panel: HTMLElement): Viewport => {
  const centerOn = (bounds: LngLatBounds) => {
    map.easeTo({ center: bounds.getCenter(), duration: 350 });
  };

  const focusBounds = (withPanel: boolean, bounds: LngLatBounds | null) => {
    if (!bounds) return;
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    const panelSize = panel.getBoundingClientRect();
    map.fitBounds(bounds, {
      padding: {
        top: 40,
        right: withPanel && !isMobile ? panelSize.width + 32 : 32,
        bottom: withPanel && isMobile ? panelSize.height + 32 : 40,
        left: 32,
      },
      duration: 350,
    });
  };

  return { centerOn, focusBounds };
};
