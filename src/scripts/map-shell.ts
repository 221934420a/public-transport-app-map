import '@material/web/button/text-button.js';
import '@material/web/divider/divider.js';
import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/labs/card/elevated-card.js';
import '@material/web/labs/card/filled-card.js';
import '@material/web/list/list-item.js';
import '@material/web/list/list.js';
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

import { createCoverageAreas } from './map/coverage-areas';
import { fillTemplate } from './map/format';
import { createInfoPanel } from './map/info-panel';
import { createMapMarkers } from './map/markers';
import { createTicketOverlay } from './map/ticket-overlay';
import type { ShellData } from './map/types';
import { bindZoomControls, createViewport } from './map/viewport';

setWorkerUrl(workerUrl);

const initialiseMapShell = (root: HTMLElement) => {
  const dataElement = root.querySelector<HTMLScriptElement>('[data-map-data]');
  const canvas = root.querySelector<HTMLElement>('[data-map-canvas]');
  const statusElement = root.querySelector<HTMLElement>('[data-map-status]');
  const panel = root.querySelector<HTMLElement>('[data-info-panel]');
  const panelTitle = root.querySelector<HTMLElement>('[data-panel-title]');
  const panelEyebrow = root.querySelector<HTMLElement>('[data-panel-eyebrow]');
  const panelIcon = root.querySelector<HTMLElement>('[data-panel-icon]');
  const panelContent = root.querySelector<HTMLElement>('[data-panel-content]');
  const panelBack =
    root.querySelector<HTMLElementTagNameMap['md-icon-button']>('[data-panel-back]');
  const panelClose =
    root.querySelector<HTMLElementTagNameMap['md-icon-button']>('[data-panel-close]');
  const zoomInButton =
    root.querySelector<HTMLElementTagNameMap['md-icon-button']>('[data-map-zoom-in]');
  const zoomOutButton =
    root.querySelector<HTMLElementTagNameMap['md-icon-button']>('[data-map-zoom-out]');

  if (
    !dataElement ||
    !canvas ||
    !panel ||
    !panelTitle ||
    !panelIcon ||
    !panelContent ||
    !panelBack ||
    !panelClose
  ) {
    return;
  }

  const mapDataError = root.dataset.mapError ?? 'Map data could not be read.';

  let data: ShellData;
  try {
    data = JSON.parse(dataElement.textContent ?? '{}') as ShellData;
  } catch {
    if (statusElement) {
      statusElement.textContent = mapDataError;
      statusElement.hidden = false;
    }
    return;
  }

  const { shell } = data;
  const copy = shell.copy;
  const appById = new Map(data.apps.map((app) => [app.id, app]));

  const map = new MapLibreMap({
    container: canvas,
    style: shell.view.style_url,
    center: shell.view.center,
    zoom: shell.view.zoom,
    maxPitch: shell.view.max_pitch,
    dragRotate: shell.view.drag_rotate,
  });

  bindZoomControls(map, zoomInButton, zoomOutButton);

  const viewport = createViewport(map, panel);

  const ticketOverlay = createTicketOverlay({
    map,
    theme: shell.theme,
    overview: shell.overview,
    centerOn: viewport.centerOn,
  });

  const infoPanel = createInfoPanel({
    root,
    elements: {
      panel,
      title: panelTitle,
      eyebrow: panelEyebrow,
      icon: panelIcon,
      content: panelContent,
      back: panelBack,
      close: panelClose,
    },
    data,
    appById,
    ticketOverlay,
  });

  const coverageAreas = createCoverageAreas({
    map,
    theme: shell.theme,
    overview: shell.overview,
    viewport,
    onSelect: infoPanel.openApp,
  });

  const markers = createMapMarkers({
    root,
    map,
    appById,
    coverages: data.coverages,
    coverageAreas,
    viewport,
    onSelect: infoPanel.openApp,
  });

  let mapReady = false;
  let areasInitStarted = false;

  const loadingTimeout = window.setTimeout(() => {
    if (statusElement && !mapReady) {
      statusElement.textContent = copy.loading_slow;
    }
  }, 12000);

  const startAreas = async () => {
    if (areasInitStarted) return;
    areasInitStarted = true;

    mapReady = true;
    window.clearTimeout(loadingTimeout);
    statusElement?.setAttribute('hidden', '');

    try {
      const detailCoverageIds = new Set<string>();
      for (const ticket of data.tickets) {
        for (const id of ticket.coverage_ids ?? []) detailCoverageIds.add(id);
      }

      const baseCoverages = data.coverages.filter(
        (coverage) => !detailCoverageIds.has(coverage.id),
      );

      await coverageAreas.load(baseCoverages);

      markers.update();
      coverageAreas.focusOverview(infoPanel.isOpen());
    } catch {
      window.clearTimeout(loadingTimeout);
      if (statusElement) {
        statusElement.textContent = copy.load_error;
        statusElement.hidden = false;
      }
    }
  };

  map.once('style.load', () => void startAreas());
  if (map.isStyleLoaded()) void startAreas();

  map.on('error', (event) => {
    if (statusElement && !mapReady) {
      statusElement.textContent = fillTemplate(copy.map_error, {
        message: event.error.message,
      });
    }
  });

  infoPanel.showIntro();
};

document.querySelectorAll<HTMLElement>('[data-map-shell]').forEach(initialiseMapShell);
