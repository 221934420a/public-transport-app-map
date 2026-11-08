/**
 * App markers are drawn by the map as one symbol layer: the marker images hold
 * the chip, the app's accent tile and its artwork, so no element per app is
 * needed.
 */
export const MARKER_SOURCE_ID = 'app-markers';
export const MARKER_LAYER_ID = 'app-markers-layer';
export const MARKER_MIN_ZOOM = 6;
export const MARKER_LABEL_ZOOM = 7.5;
/** Marker images fetched at the same time. */
export const MARKER_IMAGE_CONCURRENCY = 8;
/** Markers that share a position are stacked vertically so none is hidden. */
export const MARKER_STACK_OFFSET = 60;

/**
 * Every service area is drawn from one source with two layers; each feature
 * carries its own colours, so the layer count stays constant however many apps
 * the map shows.
 */
export const AREA_SOURCE_ID = 'area-coverages';
export const AREA_FILL_LAYER_ID = 'area-fill';
export const AREA_OUTLINE_LAYER_ID = 'area-outline';

export const TICKET_SOURCE_ID = 'ticket-area';
export const TICKET_FILL_LAYER_ID = 'ticket-fill';
export const TICKET_OUTLINE_LAYER_ID = 'ticket-outline';

/** Geometry files fetched at the same time. */
export const GEOMETRY_CONCURRENCY = 8;

/** Newly loaded areas are pushed to the map at most this often. */
export const AREA_FLUSH_INTERVAL = 150;
