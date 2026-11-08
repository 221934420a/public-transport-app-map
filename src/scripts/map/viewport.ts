import type { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';

type Box = { top: number; right: number; bottom: number; left: number };

/**
 * Zoom levels the fit camera is backed off by. A factor of three per axis leaves
 * the selected area covering about a ninth of the visible map.
 */
const AREA_ZOOM_BACKOFF = Math.log2(3);

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
  /**
   * Space the info panel hides, as map padding. The panel sits on the right on
   * desktop and across the bottom on mobile, so bounds centred with this padding
   * land in the middle of the map that is actually visible.
   */
  const panelPadding = (withPanel: boolean): Box => {
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    const panelSize = panel.getBoundingClientRect();
    const hiddenRight = withPanel && !isMobile ? panelSize.width : 0;
    const hiddenBottom = withPanel && isMobile ? panelSize.height : 0;
    return {
      top: 40,
      right: hiddenRight ? hiddenRight + 32 : 32,
      bottom: hiddenBottom ? hiddenBottom + 32 : 40,
      left: 32,
    };
  };

  const centerOn = (bounds: LngLatBounds) => {
    const padding = panelPadding(true);
    const container = map.getContainer();
    // The map the panel leaves visible. A tall bottom sheet is capped at half
    // the height so the selected area still reads at a usable size.
    const visibleWidth = Math.max(1, container.clientWidth - padding.left - padding.right);
    const visibleHeight = Math.max(
      1,
      container.clientHeight -
        padding.top -
        Math.min(padding.bottom, container.clientHeight / 2),
    );

    const northWest = map.project(bounds.getNorthWest());
    const southEast = map.project(bounds.getSouthEast());
    const boundsWidth = Math.abs(southEast.x - northWest.x);
    const boundsHeight = Math.abs(southEast.y - northWest.y);
    if (!boundsWidth || !boundsHeight) return;

    // Zoom the area to a fit, then back off so it covers about a ninth of the
    // visible map. Long, thin areas cap the backoff so nothing is pushed off
    // screen.
    const fitScale = Math.min(visibleWidth / boundsWidth, visibleHeight / boundsHeight);
    const fitFraction =
      (fitScale * boundsWidth * fitScale * boundsHeight) / (visibleWidth * visibleHeight);
    const backoff = Math.min(
      AREA_ZOOM_BACKOFF,
      Math.max(1, Math.log2(3 * Math.sqrt(fitFraction))),
    );

    // Offset the target to the middle of the map the panel leaves visible.
    map.easeTo({
      center: bounds.getCenter(),
      zoom: map.getZoom() + Math.log2(fitScale) - backoff,
      offset: [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2],
      duration: 350,
    });
  };

  const focusBounds = (withPanel: boolean, bounds: LngLatBounds | null) => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: panelPadding(withPanel), duration: 350 });
  };

  return { centerOn, focusBounds };
};
