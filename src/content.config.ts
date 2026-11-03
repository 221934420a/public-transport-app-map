import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const status = z.enum(['draft', 'verified', 'needs_review']);

/**
 * One YAML file per record. `**` allows an extra grouping folder such as
 * `coverage/greater-manchester/`. The collection entry ID comes from the
 * record's `id` field, so moving a file between region folders does not break
 * references from apps, maps, or tickets.
 */
const recordLoader = (folder: string) =>
  glob({
    pattern: '**/*.yaml',
    base: `./src/content/${folder}`,
    generateId: ({ data }) => String(data.id),
  });

const apps = defineCollection({
  loader: recordLoader('apps'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon_id: z.string().default('pin'),
    operator: z.string(),
    country_codes: z.array(z.string()),
    website_url: z.string().url(),
    app_store_urls: z.array(z.string().url()).default([]),
    transport_modes: z.array(z.string()),
    /** Fares page linked from the panel when the app's tickets are not listed. */
    tickets_url: z.string().url().optional(),
    marker: z
      .object({
        coordinates: z.tuple([z.number(), z.number()]),
        label: z.string().optional(),
      })
      .optional(),
    source_url: z.string().url(),
    checked_at: z.string(),
    status,
    notes: z.string().optional(),
  }),
});

/**
 * One icon per file. `svg` is the trusted inner markup of the SVG; keep the
 * root <svg> element in AppIcon so viewBox and accessibility stay consistent.
 */
const icons = defineCollection({
  loader: recordLoader('icons'),
  schema: z.object({
    id: z.string(),
    view_box: z.string().default('0 0 48 48'),
    class: z.string().optional(),
    svg: z.string().min(1),
  }),
});

const areaStyle = z.object({
  fill_color: z.string().optional(),
  fill_opacity: z.number().min(0).max(1).optional(),
  outline_color: z.string().optional(),
  outline_width: z.number().min(0).optional(),
  /** Optional accent for the app icon and UI chrome; defaults to the fill/outline. */
  accent: z.string().optional(),
  accent_strong: z.string().optional(),
});

/**
 * A coverage record is one app's service area. Its `geometry_refs` point at the
 * official GeoJSON polygons drawn as that app's coloured area; the area may
 * extend beyond administrative boundaries. The map draws every coverage record
 * whose `app_id` matches its app, so an app with several ticket areas (such as
 * Rejsebillet's City Pass types) keeps one record per area.
 *
 * `sort_order` is the drawing order: lower numbers are drawn first, so a
 * narrower area drawn later stays visible and wins the click where areas
 * overlap.
 */
const coverage = defineCollection({
  loader: recordLoader('coverage'),
  schema: z.object({
    id: z.string(),
    app_id: z.string(),
    name: z.string(),
    geometry_refs: z.array(z.string()).min(1),
    style: areaStyle.optional(),
    boundary_description: z.string(),
    source_url: z.string().url(),
    checked_at: z.string(),
    status,
    sort_order: z.number().default(0),
  }),
});

const tickets = defineCollection({
  loader: recordLoader('tickets'),
  schema: z.object({
    id: z.string(),
    app_id: z.string(),
    name: z.string(),
    duration: z.object({ value: z.number(), unit: z.string() }),
    price: z.object({ amount: z.number().nullable(), currency: z.string() }),
    price_options: z.array(z.object({ selection: z.string(), amount: z.number() })).optional(),
    /** Short billing-rules note shown instead of "View fares" when there is no single price. */
    price_note: z.string().optional(),
    /** Coverage areas shown on the map only when this ticket is selected. */
    coverage_ids: z.array(z.string()).default([]),
    passenger_type: z.string(),
    modes: z.array(z.string()),
    validity_description: z.string(),
    purchase_channels: z.array(z.string()),
    source_url: z.string().url(),
    checked_at: z.string(),
    status,
    notes: z.string().optional(),
    sort_order: z.number().default(0),
  }),
});

/**
 * Presentation data for one full-screen map. Ticket, fare, and boundary facts
 * stay in their own collections; this record only controls how the shell looks.
 * A shell with a `country_code` draws that country's apps only; without one it
 * draws every app, which is how the index map shows all mapped regions.
 */
const maps = defineCollection({
  loader: recordLoader('maps'),
  schema: z.object({
    id: z.string(),
    /** ISO 3166-1 alpha-2 country this map covers; omit it to draw every country. */
    country_code: z.string().optional(),
    title: z.string(),
    eyebrow: z.string().default('Public transport app'),
    page_title: z.string().optional(),
    meta_description: z.string().optional(),
    theme_color: z.string().default('#f7f2fa'),
    locale: z.string().default('en-GB'),
    featured: z.boolean().default(false),
    map_aria_label: z.string(),
    view: z.object({
      style_url: z.string().url(),
      center: z.tuple([z.number(), z.number()]),
      zoom: z.number(),
      max_pitch: z.number().default(0),
      drag_rotate: z.boolean().default(false),
    }),
    theme: z.object({
      accent: z.string(),
      accent_strong: z.string(),
      outline: z.string(),
      marker_border: z.string().default('#1d1b20'),
    }),
    overview: z
      .object({
        fill_opacity: z.number().min(0).max(1).default(0.43),
        outline_width: z.number().min(0).default(2.5),
      })
      .default({
        fill_opacity: 0.43,
        outline_width: 2.5,
      }),
    copy: z.object({
      status_chip: z.string().default('Reference fares'),
      ticket_heading: z.string().default('Ticket prices'),
      ticket_hint: z.string().default('Select a ticket to view its details.'),
      area_hint: z
        .string()
        .default('Select a coloured area or marker to see the app that serves it.'),
      back_label: z.string().default('Back'),
      close_label: z.string().default('Close information panel'),
      marker_action_label: z.string().default('View {app} coverage'),
      website_link_label: z.string().default('{app} official website'),
      description_fallback: z
        .string()
        .default('Ticket and coverage information for {app}.'),
      ticket_source_label: z.string().default('View ticket source'),
      coverage_source_label: z.string().default('View service area source'),
      ticket_meta: z.string().default('{passenger} · {duration}'),
      from_price: z.string().default('From {price}'),
      view_fares: z.string().default('View fares'),
      zoom_in_label: z.string().default('Zoom in'),
      zoom_out_label: z.string().default('Zoom out'),
      map_controls_label: z.string().default('Map controls'),
      map_data_error: z.string().default('Map data could not be read.'),
      map_error: z.string().default('Map error: {message}'),
      price_options_heading: z.string().default('Price depends on the selection'),
      loading: z.string().default('Loading map...'),
      loading_slow: z
        .string()
        .default(
          'The map is taking longer than expected. Ticket information is available in the panel.',
        ),
      load_error: z
        .string()
        .default('Could not load the mapped areas. Ticket information is still available.'),
    }),
  }),
});

export const collections = { apps, coverage, icons, tickets, maps };
