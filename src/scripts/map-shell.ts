import '@material/web/button/text-button.js';
import '@material/web/divider/divider.js';
import '@material/web/fab/fab.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/labs/card/elevated-card.js';
import '@material/web/labs/card/filled-card.js';
import '@material/web/list/list-item.js';
import '@material/web/list/list.js';
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

type Coordinate = [number, number];

type AreaStyle = {
  fill_color?: string;
  fill_opacity?: number;
  outline_color?: string;
  outline_width?: number;
};

type Coverage = {
  id: string;
  app_id: string;
  name: string;
  geometry_refs: string[];
  boundary_description: string;
  source_url: string;
  checked_at: string;
  status: string;
  sort_order?: number;
  style?: AreaStyle;
};

type AppIcon = {
  view_box: string;
  class?: string;
  svg: string;
};

type App = {
  id: string;
  name: string;
  description?: string;
  website_url: string;
  tickets_url?: string;
  accent: string;
  accent_strong: string;
  icon?: AppIcon;
  marker?: { coordinates: Coordinate; label?: string };
};

type Ticket = {
  id: string;
  app_id: string;
  name: string;
  price: { amount: number | null; currency: string };
  price_options?: { selection: string; amount: number }[];
  price_note?: string;
  coverage_ids?: string[];
  duration: { value: number; unit: string };
  passenger_type: string;
  validity_description: string;
  source_url: string;
  sort_order: number;
};

type ShellCopy = {
  status_chip: string;
  ticket_heading: string;
  ticket_hint: string;
  area_hint: string;
  website_link_label: string;
  description_fallback: string;
  ticket_source_label: string;
  coverage_source_label: string;
  ticket_meta: string;
  from_price: string;
  view_fares: string;
  price_options_heading: string;
  map_data_error: string;
  map_error: string;
  loading_slow: string;
  load_error: string;
};

type MapShell = {
  id: string;
  title: string;
  eyebrow: string;
  locale: string;
  view: {
    style_url: string;
    center: Coordinate;
    zoom: number;
    max_pitch: number;
    drag_rotate: boolean;
  };
  theme: {
    accent: string;
    accent_strong: string;
    outline: string;
  };
  overview: {
    fill_opacity: number;
    outline_width: number;
  };
  copy: ShellCopy;
};

type ShellData = {
  shell: MapShell;
  apps: App[];
  coverages: Coverage[];
  tickets: Ticket[];
};

const MARKER_ICON_ONLY_ZOOM = 7.5;
const MARKER_HIDE_ZOOM = 6;

/**
 * Every service area is drawn from one source with two layers; each feature
 * carries its own colours, so the layer count stays constant however many apps
 * the map shows.
 */
const AREA_SOURCE_ID = 'area-coverages';
const AREA_FILL_LAYER_ID = 'area-fill';
const AREA_OUTLINE_LAYER_ID = 'area-outline';

/** Geometry files fetched at the same time. */
const GEOMETRY_CONCURRENCY = 8;

/** Newly loaded areas are pushed to the map at most this often. */
const AREA_FLUSH_INTERVAL = 150;

/** Geometry is cached across every map shell on the page. */
const geometryCache = new Map<string, Promise<any>>();

const fetchGeometry = (geometryRef: string): Promise<any[]> => {
  const [path, featureId] = geometryRef.split('#');
  const url = path.startsWith('/') ? path : `/${path}`;

  let request = geometryCache.get(url);
  if (!request) {
    request = fetch(url, { signal: AbortSignal.timeout(12000) })
      .then((response) => {
        if (!response.ok) throw new Error(`Geometry request failed: ${url}`);
        return response.json();
      })
      .catch((error) => {
        geometryCache.delete(url);
        throw error;
      });
    geometryCache.set(url, request);
  }

  return request.then((collection: any) => {
    const features: any[] = collection.features ?? [];
    if (!featureId) return features;
    return features.filter(
      (feature) =>
        String(feature.id) === featureId ||
        String(feature.properties?.id) === featureId,
    );
  });
};

const boundsFromFeatures = (features: any[]) => {
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

const mergeBounds = (current: LngLatBounds | null, next: LngLatBounds | null) => {
  if (!current) return next;
  if (!next) return current;
  return current.extend(next.getSouthWest()).extend(next.getNorthEast());
};

const fillTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

const el = (tag: string, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const withSlot = (node: HTMLElement, slot: string) => {
  node.setAttribute('slot', slot);
  return node;
};

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
    attributionControl: true,
  });

  const updateZoomButtons = () => {
    if (zoomInButton) zoomInButton.disabled = map.getZoom() >= map.getMaxZoom();
    if (zoomOutButton) zoomOutButton.disabled = map.getZoom() <= map.getMinZoom();
  };

  zoomInButton?.addEventListener('click', () => map.zoomIn());
  zoomOutButton?.addEventListener('click', () => map.zoomOut());
  map.on('zoom', updateZoomButtons);
  map.on('load', updateZoomButtons);
  updateZoomButtons();

  /** Drawn bounds of each base area, so an app marker can focus the same range. */
  const coverageBoundsById = new Map<string, LngLatBounds>();

  const markerElements = Array.from(
    root.querySelectorAll<HTMLElement>('[data-map-marker]'),
  );
  /** Markers that share a position are stacked vertically so none is hidden. */
  const MARKER_STACK_OFFSET = 60;
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
      openApp(app.id);
      const coverage = data.coverages.find((entry) => entry.app_id === app.id);
      const bounds = coverage ? coverageBoundsById.get(coverage.id) : undefined;
      if (bounds) centerOn(bounds);
    });
  }

  const updateMarkers = () => {
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

  map.on('zoom', updateMarkers);
  map.on('load', updateMarkers);

  let areaBounds: LngLatBounds | null = null;
  let mapReady = false;
  let areasInitStarted = false;
  let currentApp: App | null = null;
  let currentCoverage: Coverage | undefined;
  let currentTicketId: string | null = null;

  const loadingTimeout = window.setTimeout(() => {
    if (statusElement && !mapReady) {
      statusElement.textContent = copy.loading_slow;
    }
  }, 12000);

  const formatMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat(shell.locale, { style: 'currency', currency }).format(amount);

  const formatDuration = (duration: { value: number; unit: string }) => {
    try {
      return new Intl.NumberFormat(shell.locale, {
        style: 'unit',
        unit: duration.unit as Intl.NumberFormatOptions['unit'],
        unitDisplay: 'long',
      }).format(duration.value);
    } catch {
      return `${duration.value} ${duration.unit}`;
    }
  };

  const focusArea = (withPanel: boolean, bounds = areaBounds) => {
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

  const centerOn = (bounds: LngLatBounds) => {
    map.easeTo({ center: bounds.getCenter(), duration: 350 });
  };

  const setAccent = (accent: string, accentStrong: string) => {
    root.style.setProperty('--map-accent', accent);
    root.style.setProperty('--map-accent-strong', accentStrong);
  };

  const setPanelIcon = (icon?: AppIcon) => {
    if (icon) {
      panelIcon.innerHTML = `<svg viewBox="${icon.view_box}" focusable="false" aria-hidden="true"${
        icon.class ? ` class="${icon.class}"` : ''
      }>${icon.svg}</svg>`;
      panelIcon.hidden = false;
    } else {
      panelIcon.replaceChildren();
      panelIcon.hidden = true;
    }
  };

  const priceLabel = (ticket: Ticket) => {
    if (ticket.price_options?.length) {
      const minimum = Math.min(...ticket.price_options.map((option) => option.amount));
      return fillTemplate(copy.from_price, {
        price: formatMoney(minimum, ticket.price.currency),
      });
    }
    return ticket.price.amount === null
      ? copy.view_fares
      : formatMoney(ticket.price.amount, ticket.price.currency);
  };

  const ticketMeta = (ticket: Ticket) => {
    const passenger = ticket.passenger_type;
    return fillTemplate(copy.ticket_meta, {
      passenger: passenger.charAt(0).toUpperCase() + passenger.slice(1),
      duration: formatDuration(ticket.duration),
    });
  };

  const linkButton = (label: string, href: string) => {
    const button = document.createElement('md-text-button');
    button.className = 'panel-link';
    button.setAttribute('href', href);
    button.setAttribute('target', '_blank');
    button.textContent = label;
    return button;
  };

  const externalLink = (label: string, href: string, className: string) => {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.append(document.createTextNode(label));
    const icon = document.createElement('md-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'open_in_new';
    link.append(icon);
    return link;
  };

  const emptyCollection = () => ({
    type: 'FeatureCollection' as const,
    features: [] as unknown[],
  });

  let ticketAreaAdded = false;

  const ensureTicketArea = (style: AreaStyle) => {
    const fillColor = style.fill_color ?? shell.theme.accent;
    const fillOpacity = style.fill_opacity ?? 0.35;
    const outlineColor = style.outline_color ?? shell.theme.outline;
    const outlineWidth = style.outline_width ?? shell.overview.outline_width;

    if (ticketAreaAdded) {
      map.setPaintProperty('ticket-fill', 'fill-color', fillColor);
      map.setPaintProperty('ticket-fill', 'fill-opacity', fillOpacity);
      map.setPaintProperty('ticket-outline', 'line-color', outlineColor);
      map.setPaintProperty('ticket-outline', 'line-width', outlineWidth);
      return;
    }

    map.addSource('ticket-area', { type: 'geojson', data: emptyCollection() });
    map.addLayer({
      id: 'ticket-fill',
      type: 'fill',
      source: 'ticket-area',
      paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity },
    });
    map.addLayer({
      id: 'ticket-outline',
      type: 'line',
      source: 'ticket-area',
      paint: { 'line-color': outlineColor, 'line-width': outlineWidth },
    });
    ticketAreaAdded = true;
  };

  const setTicketArea = (features: any[], style: AreaStyle) => {
    ensureTicketArea(style);
    const source = map.getSource('ticket-area') as
      | { setData?: (data: unknown) => void }
      | undefined;
    source?.setData?.({ type: 'FeatureCollection', features });
    const bounds = boundsFromFeatures(features);
    if (bounds) centerOn(bounds);
  };

  const clearTicketArea = () => {
    if (!ticketAreaAdded) return;
    const source = map.getSource('ticket-area') as
      | { setData?: (data: unknown) => void }
      | undefined;
    source?.setData?.(emptyCollection());
  };

  const showTicketArea = async (ticket: Ticket, coverages: Coverage[]) => {
    try {
      const groups = await Promise.all(
        coverages.flatMap((coverage) =>
          coverage.geometry_refs.map((ref) =>
            fetchGeometry(ref).catch(() => [] as any[]),
          ),
        ),
      );
      const features = groups.flat();
      if (currentTicketId !== ticket.id) return;
      setTicketArea(features, coverages[0]?.style ?? {});
    } catch {
      clearTicketArea();
    }
  };

  const renderIntro = () => {
    currentApp = null;
    currentCoverage = undefined;
    currentTicketId = null;
    clearTicketArea();
    setAccent(shell.theme.accent, shell.theme.accent_strong);
    setPanelIcon(undefined);
    panelTitle.textContent = shell.title;
    if (panelEyebrow) panelEyebrow.textContent = shell.eyebrow;
    panelBack.hidden = true;
    panelContent.replaceChildren(
      el('p', 'body-copy md-typescale-body-medium text-muted', copy.area_hint),
    );
  };

  const renderApp = (app: App, coverage?: Coverage) => {
    currentApp = app;
    currentCoverage = coverage;
    currentTicketId = null;
    clearTicketArea();
    setAccent(app.accent, app.accent_strong);
    setPanelIcon(app.icon);
    panelTitle.textContent = app.name;
    if (panelEyebrow) panelEyebrow.textContent = shell.eyebrow;
    panelBack.hidden = true;

    const parts: Node[] = [];

    const summary = el('section', 'app-summary');
    summary.append(
      el(
        'p',
        'body-copy md-typescale-body-medium text-muted',
        app.description ?? fillTemplate(copy.description_fallback, { app: app.name }),
      ),
      linkButton(fillTemplate(copy.website_link_label, { app: app.name }), app.website_url),
    );
    parts.push(summary);

    const appTickets = data.tickets
      .filter((ticket) => ticket.app_id === app.id)
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
      );

    const section = el('section', 'ticket-section');
    const headingRow = el('div', 'section-heading-row');
    const heading = el('h2', 'md-typescale-title-medium');
    if (appTickets.length) {
      heading.textContent = copy.ticket_heading;
    } else {
      heading.append(
        externalLink(
          copy.ticket_heading,
          app.tickets_url ?? app.website_url,
          'ticket-heading-link',
        ),
      );
    }
    headingRow.append(
      heading,
      el('span', 'status-chip md-typescale-label-medium', copy.status_chip),
    );
    section.append(headingRow);

    if (appTickets.length) {
      section.append(
        el('p', 'section-hint md-typescale-body-small text-muted', copy.ticket_hint),
      );
      const list = el('md-list', 'ticket-list');
      appTickets.forEach((ticket, index) => {
        if (index > 0) list.append(document.createElement('md-divider'));
        const clickable =
          (ticket.price_options?.length ?? 0) > 0 ||
          Boolean(ticket.price_note) ||
          (ticket.coverage_ids?.length ?? 0) > 0;
        const item = document.createElement('md-list-item');
        item.setAttribute('multiline', '');
        if (clickable) {
          item.setAttribute('type', 'button');
          item.dataset.ticketId = ticket.id;
        }

        item.append(
          withSlot(el('span', 'md-typescale-title-small', ticket.name), 'headline'),
          withSlot(el('span', 'md-typescale-body-small', ticketMeta(ticket)), 'supporting-text'),
          withSlot(
            el('span', 'ticket-price md-typescale-title-small', priceLabel(ticket)),
            'trailing-supporting-text',
          ),
        );

        if (clickable) {
          const icon = document.createElement('md-icon');
          icon.setAttribute('slot', 'end');
          icon.setAttribute('aria-hidden', 'true');
          icon.textContent = 'chevron_right';
          item.append(icon);
        }

        list.append(item);
      });
      section.append(list);
    }
    parts.push(section);

    if (coverage) {
      parts.push(
        el('p', 'coverage-note md-typescale-body-small text-muted', coverage.boundary_description),
        linkButton(copy.coverage_source_label, coverage.source_url),
      );
    }

    panelContent.replaceChildren(...parts);
  };

  const renderTicket = (app: App, ticket: Ticket) => {
    currentTicketId = ticket.id;
    setPanelIcon(undefined);
    panelTitle.textContent = ticket.name;
    if (panelEyebrow) panelEyebrow.textContent = app.name;
    panelBack.hidden = false;

    const parts: Node[] = [];

    const card = el('md-filled-card', 'ticket-price-card');
    const priceBox = el('div', 'ticket-price');
    if (ticket.price_options?.length) {
      priceBox.append(el('p', 'price-heading md-typescale-label-large', copy.price_options_heading));
      const list = el('md-list', 'price-options');
      for (const option of ticket.price_options) {
        const row = document.createElement('md-list-item');
        row.append(
          withSlot(el('span', 'md-typescale-body-medium', option.selection), 'headline'),
          withSlot(
            el(
              'strong',
              'price-option-amount md-typescale-title-small',
              formatMoney(option.amount, ticket.price.currency),
            ),
            'trailing-supporting-text',
          ),
        );
        list.append(row);
      }
      priceBox.append(list);
    } else if (ticket.price.amount === null && ticket.price_note) {
      const note = el('div', 'price-note md-typescale-body-medium');
      for (const line of ticket.price_note.split('\n')) {
        note.append(el('p', 'price-note-line', line));
      }
      priceBox.append(note);
    } else {
      priceBox.append(el('strong', 'price-single md-typescale-headline-small', priceLabel(ticket)));
    }
    card.append(priceBox);
    parts.push(
      card,
      el('p', 'body-copy md-typescale-body-medium text-muted', ticket.validity_description),
      linkButton(copy.ticket_source_label, ticket.source_url),
    );

    panelContent.replaceChildren(...parts);

    const ticketCoverages = data.coverages.filter((coverage) =>
      (ticket.coverage_ids ?? []).includes(coverage.id),
    );
    if (ticketCoverages.length) {
      void showTicketArea(ticket, ticketCoverages);
    } else {
      clearTicketArea();
    }
  };

  const openApp = (appId: string, coverageId?: string) => {
    const app = appById.get(appId);
    if (!app) return;
    const coverage = coverageId
      ? data.coverages.find((entry) => entry.id === coverageId)
      : data.coverages.find((entry) => entry.app_id === appId);
    panel.hidden = false;
    renderApp(app, coverage);
  };

  panelContent.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !currentApp) return;
    const item = event.target.closest<HTMLElement>('[data-ticket-id]');
    if (!item) return;
    const ticket = data.tickets.find((entry) => entry.id === item.dataset.ticketId);
    if (ticket) renderTicket(currentApp, ticket);
  });

  panelBack.addEventListener('click', () => {
    if (currentApp && currentTicketId) renderApp(currentApp, currentCoverage);
    else renderIntro();
  });
  panelClose.addEventListener('click', () => {
    panel.hidden = true;
    renderIntro();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) panelClose.click();
  });

  /**
   * Copy each feature before adding the style the paint expressions read:
   * geometry files are cached and shared between coverage records, so mutating
   * a feature in place would leak one area's style into another.
   */
  const decorateArea = (coverage: Coverage, features: any[]) => {
    const style = coverage.style ?? {};
    const decoration = {
      areaFillColor: style.fill_color ?? shell.theme.accent,
      areaFillOpacity: style.fill_opacity ?? shell.overview.fill_opacity,
      areaOutlineColor: style.outline_color ?? shell.theme.outline,
      areaOutlineWidth: style.outline_width ?? shell.overview.outline_width,
      coverageId: coverage.id,
      appId: coverage.app_id,
      areaSort: coverage.sort_order ?? 0,
    };
    return features.map((feature) => ({
      ...feature,
      properties: { ...(feature.properties ?? {}), ...decoration },
    }));
  };

  const addAreaLayers = () => {
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
      openApp(String(top.properties?.appId ?? ''), coverageId || undefined);
      const bounds = coverageBoundsById.get(coverageId);
      if (bounds) centerOn(bounds);
    });
    map.on('mouseenter', AREA_FILL_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', AREA_FILL_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
  };

  const initialiseAreas = async () => {
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

      addAreaLayers();
      const source = map.getSource(AREA_SOURCE_ID) as GeoJSONSource;
      const loaded: any[] = [];

      // Fetches finish out of order, but features must reach the source in
      // sort_order, so completed areas wait until every earlier one is done.
      const pending: ({ coverage: Coverage; features: any[] } | null)[] = baseCoverages.map(
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
            coverageBoundsById.set(entry.coverage.id, bounds);
            areaBounds = mergeBounds(areaBounds, bounds);
          }
          appended = true;
        }
        if (appended && flushTimer === null) {
          flushTimer = window.setTimeout(flush, AREA_FLUSH_INTERVAL);
        }
      };

      let cursor = 0;
      const loadAreas = async () => {
        while (cursor < baseCoverages.length) {
          const index = cursor;
          cursor += 1;
          const coverage = baseCoverages[index];
          const groups = await Promise.all(
            coverage.geometry_refs.map((ref) => fetchGeometry(ref).catch(() => [] as any[])),
          );
          pending[index] = { coverage, features: decorateArea(coverage, groups.flat()) };
          drain();
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(GEOMETRY_CONCURRENCY, baseCoverages.length) }, loadAreas),
      );

      if (flushTimer !== null) window.clearTimeout(flushTimer);
      flush();

      updateMarkers();
      focusArea(!panel.hidden);
    } catch {
      window.clearTimeout(loadingTimeout);
      if (statusElement) {
        statusElement.textContent = copy.load_error;
        statusElement.hidden = false;
      }
    }
  };

  map.once('style.load', () => void initialiseAreas());
  if (map.isStyleLoaded()) void initialiseAreas();

  map.on('error', (event) => {
    if (statusElement && !mapReady) {
      statusElement.textContent = fillTemplate(copy.map_error, {
        message: event.error.message,
      });
    }
  });

  renderIntro();
};

document.querySelectorAll<HTMLElement>('[data-map-shell]').forEach(initialiseMapShell);
