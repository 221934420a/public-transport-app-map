import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  MARKER_IMAGE_CONCURRENCY,
  MARKER_LABEL_ZOOM,
  MARKER_LAYER_ID,
  MARKER_MIN_ZOOM,
  MARKER_SOURCE_ID,
  MARKER_STACK_OFFSET,
} from './constants';
import type { CoverageAreas } from './coverage-areas';
import type { App, Coverage } from './types';
import type { Viewport } from './viewport';
import markerGeometry from '../../../scripts/marker-geometry.json';

/**
 * The marker's shape lives in scripts/marker-geometry.json, which the build
 * script (scripts/build-icons.mjs) reads too, so the icon-only and the
 * icon-with-name pictures always agree. All values are CSS pixels.
 */
const geometry = markerGeometry;
/** Images are painted at 2x for crisp edges on high-density screens. */
const IMAGE_SCALE = 2;
const IMAGE_HEIGHT = geometry.height + geometry.margin * 2;
const PILL_COLOR = '#ECE6F0';
const TEXT_COLOR = '#1d1b20';
const LABEL_FONT_SIZE = 14;
/** Spacing follows the type size, like the Material extended FAB. */
const LABEL_GAP = Math.round(LABEL_FONT_SIZE * 1.15);
const LABEL_TRAILING = Math.round(LABEL_FONT_SIZE * 1.4);
const LABEL_FONT = `500 ${LABEL_FONT_SIZE}px Roboto, "Helvetica Neue", Arial, sans-serif`;
/** Name images built per animation frame, so zooming stays responsive. */
const LABEL_BATCH = 8;

export type MapMarkers = {
  initialise: () => void;
};

/**
 * App markers as symbol layers. Each app has a marker image in public/markers
 * holding its chip, accent tile and artwork (scripts/build-icons), which the map
 * draws on the GPU instead of one element per app. Once a marker is zoomed in
 * far enough, a second image is painted for it: the same shape grown to fit the
 * app's name, so the icon and the name are one picture and cannot drift apart.
 */
export const createMapMarkers = (options: {
  root: HTMLElement;
  map: MapLibreMap;
  appById: Map<string, App>;
  coverages: Coverage[];
  coverageAreas: CoverageAreas;
  viewport: Viewport;
  onSelect: (appId: string) => void;
}): MapMarkers => {
  const { root, map, appById, coverages, coverageAreas, viewport, onSelect } = options;

  const markerApps = [...appById.values()].filter((app) => app.marker);
  const chipLayerIds: string[] = [];

  const boundsFor = (app: App) => {
    const coverage = coverages.find((entry) => entry.app_id === app.id);
    return coverage ? coverageAreas.boundsFor(coverage.id) : undefined;
  };

  const selectApp = (app: App) => {
    onSelect(app.id);
    const bounds = boundsFor(app);
    if (bounds) viewport.centerOn(bounds);
  };

  // The map draws the markers itself, so keyboard and screen-reader users reach
  // the same apps through a list of links that stays visually hidden.
  for (const link of root.querySelectorAll<HTMLElement>('[data-marker-link]')) {
    const app = appById.get(link.dataset.appId ?? '');
    if (!app?.marker) {
      link.hidden = true;
      continue;
    }
    link.addEventListener('click', () => selectApp(app));
    link.addEventListener('focus', () => {
      const bounds = boundsFor(app);
      if (bounds) viewport.centerOn(bounds);
    });
  }

  /** Marker images by app, kept so a name can be drawn onto its marker. */
  const chipImages = new Map<string, ImageBitmap>();

  const loadImages = async () => {
    const images = new Map<string, ImageBitmap>();
    let cursor = 0;

    const loadNext = async () => {
      while (cursor < markerApps.length) {
        const app = markerApps[cursor];
        cursor += 1;
        try {
          const response = await fetch(`/markers/${app.id}.png`);
          if (!response.ok) continue;
          images.set(app.id, await createImageBitmap(await response.blob()));
        } catch {
          // A marker image that fails to load only means that app draws none.
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MARKER_IMAGE_CONCURRENCY, markerApps.length) }, loadNext),
    );

    // Registered in one go so the style updates, and the map repaints, once.
    for (const [id, image] of images) {
      chipImages.set(id, image);
      if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: IMAGE_SCALE });
    }

    // Names drawn before their chip had loaded can be painted now.
    void buildVisibleLabels();
  };

  /**
   * The marker with its name, painted with the page's own font. Everything is
   * derived from the shared geometry and the measured text: one rounded shape
   * grows to fit the name, with the chip's tile and artwork inside it and the
   * name after the icon. Painting both into one shape means the name can never
   * cover the icon or leave a seam where the two meet.
   */
  const labeledImage = (app: App, measure: CanvasRenderingContext2D) => {
    const chip = chipImages.get(app.id);
    if (!chip) return null;

    const label = app.marker!.label ?? app.name;
    measure.font = LABEL_FONT;
    const textWidth = Math.ceil(measure.measureText(label).width);
    const { height, radius, margin, tile } = geometry;

    const width = margin + height + LABEL_GAP + textWidth + LABEL_TRAILING + margin;
    const canvas = document.createElement('canvas');
    canvas.width = width * IMAGE_SCALE;
    canvas.height = IMAGE_HEIGHT * IMAGE_SCALE;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.scale(IMAGE_SCALE, IMAGE_SCALE);

    // One continuous shape, exactly the height of the icon chip.
    context.beginPath();
    context.roundRect(margin, margin, width - margin * 2, height, radius);
    context.fillStyle = PILL_COLOR;
    context.shadowColor = 'rgba(0, 0, 0, 0.3)';
    context.shadowBlur = geometry.shadowBlur;
    context.shadowOffsetY = geometry.shadowOffsetY;
    context.fill();

    // The chip's tile and artwork, clipped to the tile so the chip's own rounded
    // corners and shadow cannot show inside the joined shape.
    context.shadowColor = 'transparent';
    const tileInset = margin + (height - tile) / 2;
    context.save();
    context.beginPath();
    context.rect(tileInset, tileInset, tile, tile);
    context.clip();
    context.drawImage(chip, 0, 0, height + margin * 2, height + margin * 2);
    context.restore();

    context.fillStyle = TEXT_COLOR;
    context.font = LABEL_FONT;
    context.textBaseline = 'middle';
    context.fillText(label, margin + height + LABEL_GAP, margin + height / 2);

    return context.getImageData(0, 0, canvas.width, canvas.height);
  };

  let building = false;
  const buildVisibleLabels = async () => {
    if (building || map.getZoom() < MARKER_LABEL_ZOOM) return;
    building = true;
    try {
      // Roboto comes from the page's stylesheet. Load the medium face before
      // measuring: measuring with the fallback font would size a pill for the
      // wrong text width and clip the name.
      try {
        await document.fonts.load(LABEL_FONT);
      } catch {
        // Drawing with the browser's default sans-serif is still better than
        // leaving the marker without its name.
      }

      const visible = new Set<string>();
      for (const id of chipLayerIds) {
        for (const feature of map.queryRenderedFeatures({ layers: [id] })) {
          visible.add(String(feature.properties?.appId ?? ''));
        }
      }

      const measure = document.createElement('canvas').getContext('2d');
      if (!measure) return;

      let batch = 0;
      for (const app of markerApps) {
        if (!visible.has(app.id) || map.hasImage(`${app.id}-label`)) continue;
        const image = labeledImage(app, measure);
        if (image) map.addImage(`${app.id}-label`, image, { pixelRatio: IMAGE_SCALE });
        batch += 1;
        if (batch % LABEL_BATCH === 0) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
    } finally {
      building = false;
    }
  };

  const initialise = () => {
    if (!markerApps.length) return;

    // Markers that share a position are stacked vertically so none is hidden.
    const stacks = new Map<string, number>();
    let deepestStack = 0;
    const features = markerApps.map((app) => {
      const [lon, lat] = app.marker!.coordinates;
      const key = `${lon.toFixed(4)},${lat.toFixed(4)}`;
      const stack = stacks.get(key) ?? 0;
      stacks.set(key, stack + 1);
      deepestStack = Math.max(deepestStack, stack);
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: app.marker!.coordinates },
        properties: {
          appId: app.id,
          markerImage: app.id,
          labelImage: `${app.id}-label`,
          stack,
        },
      };
    });

    map.addSource(MARKER_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    // One layer per stack depth: the offset is a layer property, so stacked
    // markers need their own layer rather than a per-feature value.
    for (let depth = 0; depth <= deepestStack; depth += 1) {
      const layerId = depth === 0 ? MARKER_LAYER_ID : `${MARKER_LAYER_ID}-${depth}`;
      const offsetY = -depth * MARKER_STACK_OFFSET;
      chipLayerIds.push(layerId);

      map.addLayer({
        id: layerId,
        type: 'symbol',
        source: MARKER_SOURCE_ID,
        minzoom: MARKER_MIN_ZOOM,
        filter: ['==', ['get', 'stack'], depth],
        layout: {
          'icon-image': ['get', 'markerImage'],
          'icon-anchor': 'bottom',
          'icon-offset': [0, offsetY],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // The marker with its name in one picture. It is anchored on the chip's
      // centre, so the extra width only grows to the right, and nothing is drawn
      // until the image has been painted for that app.
      const labelId = `${layerId}-label`;
      map.addLayer({
        id: labelId,
        type: 'symbol',
        source: MARKER_SOURCE_ID,
        minzoom: MARKER_LABEL_ZOOM,
        filter: ['==', ['get', 'stack'], depth],
        layout: {
          'icon-image': ['get', 'labelImage'],
          'icon-anchor': 'bottom-left',
          'icon-offset': [-(geometry.margin + geometry.height / 2), offsetY],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      for (const id of [layerId, labelId]) {
        map.on('click', id, (event) => {
          const app = appById.get(String(event.features?.[0]?.properties?.appId ?? ''));
          if (app) selectApp(app);
        });
        map.on('mouseenter', id, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', id, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    }

    // Names are painted once the map has settled, so the features in view are
    // known; 'idle' fires after the render that follows a zoom or pan.
    map.on('idle', () => void buildVisibleLabels());

    void loadImages();
    void buildVisibleLabels();
  };

  return { initialise };
};
