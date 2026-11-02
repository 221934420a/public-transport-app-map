# Transport data YAML fields

The YAML files are the editable source of truth for presentation, ticket, and
service-area metadata. Geographic coordinates stay in GeoJSON under `public/geo/`;
YAML refers to those files with `geometry_refs`.

Every record lives in its own YAML file. Astro's `glob()` content loader picks up
new files automatically, so adding an app, map, service area, or ticket does not
require editing `src/content.config.ts`.

```text
src/content/
  apps/                          one app per file
  coverage/
    greater-manchester/          one service area per file (one per app)
  icons/                         one app icon per file
  maps/                          one full-screen map shell per file
  tickets/
    greater-manchester/          one ticket per file
public/geo/
  *.geojson                      polygon geometry, optionally addressed with #feature-id
```

The region folder is for authoring and review. It is not used as the record ID:
the `id` field remains globally unique, so moving a file between folders does not
break references from apps, maps, or tickets.

## Shared conventions

- IDs are stable, lowercase slugs, globally unique, and should match the filename without `.yaml`.
- Prices are numeric amounts with an ISO currency code; do not include a currency symbol in the value.
- Every factual record has `source_url` and `checked_at` (`YYYY-MM-DD`).
- Use `status: draft` when the facts or geometry still need checking. Do not display draft geometry as a verified boundary.
- A coverage record is one app's **service area**. It may extend beyond administrative boundaries and may list more than one `geometry_refs` entry.
- Keep coordinate arrays out of YAML. Put them in a GeoJSON file and use `geometry_refs`.

## App record (`src/content/apps/*.yaml`)

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable slug; must match the filename. |
| `name` | yes | Public-facing app name. |
| `description` | no | Short public summary shown in the panel. |
| `icon_id` | no | ID of an icon record; defaults to `pin`. |
| `operator` | yes | Organisation responsible for the app/tickets. |
| `country_codes` | yes | ISO 3166-1 alpha-2 country codes where its mapped services are located. |
| `website_url` | yes | Official product/app information. |
| `app_store_urls` | no | Official iOS/Android download pages. |
| `transport_modes` | yes | Controlled values such as `bus`, `tram`, `train`, `ferry`. |
| `source_url` | yes | Official source supporting the app/ticket availability claims. |
| `checked_at` | yes | Date last checked. |
| `status` | yes | `draft`, `verified`, or `needs_review`. |
| `notes` | no | Internal authoring notes; not shown in the panel. |

## Icon record (`src/content/icons/*.yaml`)

`AppIcon.astro` is a generic renderer. The icon artwork lives in YAML, so a new
app icon does not require editing a component. `apps/<id>.yaml` points at it
with `icon_id`.

```yaml
id: bee
view_box: '0 0 48 48'
class: app-icon-bee        # optional class on the root <svg>
svg: |
  <path fill="#ffffff" stroke="#1d1b20" stroke-width="1.5" d="..." />
  <ellipse fill="#1d1b20" cx="24" cy="25" rx="6" ry="10" />
```

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Icon ID referenced by `apps/<id>.yaml` → `icon_id`. |
| `view_box` | no | SVG viewBox; defaults to `0 0 48 48`. |
| `class` | no | Optional class added to the root `<svg>`. |
| `svg` | yes | Trusted inner SVG markup. Do not include a root `<svg>` or scripts. |

The icon is rendered with `set:html`, so the YAML is trusted authoring data.
Keep brand colours in the SVG; CSS variables such as
`var(--map-accent, #f6c900)` also work in inline `style` attributes if an icon
should follow the map theme.

A map can override the app icon with `marker.icon`; otherwise the app's
`icon_id` is used. If the ID is missing, the build falls back to the `pin` icon.

## Service-area record (`src/content/coverage/<region>/*.yaml`)

A coverage record is one app's service area, and it is also the coloured area
the map draws for that app. The map draws every coverage record whose `app_id`
matches its app; a ticket's precise limits stay in its `validity_description`.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable coverage ID. |
| `app_id` | yes | ID from an app record. |
| `name` | yes | Human-readable name for this service area. |
| `geometry_refs` | yes | One or more GeoJSON paths/feature IDs, e.g. `/geo/greater-manchester.geojson#greater-manchester`. |
| `style` | no | `fill_color`, `fill_opacity`, `outline_color`, `outline_width` for this block. |
| `boundary_description` | yes | Plain-language definition of the boundary, shown in the panel. |
| `source_url` | yes | Official map or rules for the boundary. |
| `checked_at` | yes | Date last checked. |
| `status` | yes | `draft`, `verified`, or `needs_review`. |

The service area is the extent of the app's tickets. It must not be read as the
validity area of every individual ticket; those limits remain explicit per
ticket.

```yaml
id: bee-network-service-area
app_id: bee-network
name: Bee Network service area
geometry_refs:
  - /geo/greater-manchester.geojson#greater-manchester
  - /geo/bee-network-anybus.geojson
style:
  fill_color: '#f6c900'
  fill_opacity: 0.43
  outline_color: '#9a7200'
  outline_width: 2.5
boundary_description: >-
  Greater Manchester plus the official TfGM AnyBus outer areas.
source_url: https://tfgm.com/public-transport/maps/greater-manchester-bus-boundary-map/anybus
checked_at: '2026-11-01'
status: draft
```

## Ticket record (`src/content/tickets/<region>/*.yaml`)

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable ticket ID. |
| `app_id` | yes | App that sells the ticket. |
| `name` | yes | Official ticket name. |
| `duration` | yes | Numeric `value` and unit such as `day`. |
| `price` | yes | `amount` and `currency`. Use `amount: null` when fares vary. |
| `price_options` | no | Selection label and numeric amount pairs. |
| `passenger_type` | yes | For example `adult`, `child`, or `family`. |
| `modes` | yes | Modes covered. |
| `validity_description` | yes | Human-readable service, time, zone and expiry restrictions. |
| `purchase_channels` | yes | For example `app`, `on_bus`, `ticket_machine`. |
| `source_url` | yes | Official ticket page. |
| `checked_at` | yes | Date last checked. |
| `status` | yes | `draft`, `verified`, or `needs_review`. |
| `sort_order` | no | Display order in the ticket list; lower numbers appear first. |

## Map shell record (`src/content/maps/*.yaml`)

The map shell record controls presentation only. Ticket and area facts stay in
their own collections. One record renders one full-screen map, and the map draws
every service area that belongs to its app.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable map ID; must match the filename. |
| `app_id` | yes | App whose tickets and service areas populate this shell. |
| `title` | yes | Short map title. |
| `eyebrow` | no | Small label above the panel title. |
| `page_title` | no | `<title>` for the standalone page. |
| `meta_description` | no | Meta description for the page. |
| `theme_color` | no | Browser theme colour. |
| `locale` | no | BCP 47 locale used for price formatting; defaults to `en-GB`. |
| `featured` | no | Marks the map used by `src/pages/index.astro`. |
| `map_aria_label` | yes | Accessible name for the map region. |
| `view` | yes | `style_url`, `center`, `zoom`, `max_pitch`, `drag_rotate`. |
| `marker` | yes | `coordinates`, optional `icon` override, and `label`. |
| `theme` | yes | `accent`, `accent_strong`, `outline`, `marker_border` colours. |
| `overview` | no | `fill_opacity` and `outline_width` used for areas without their own `style`. |
| `copy` | yes | UI strings. |

### Adding an app

1. Add an app YAML under `src/content/apps/`.
2. Add the official GeoJSON to `public/geo/`.
3. Add `src/content/coverage/<region>/<app>-service-area.yaml` with
   `geometry_refs` (and optional `style`).
4. Add a `src/content/maps/<id>.yaml` shell record.
5. Add `src/pages/<id>.astro` that renders `<MapPage mapId="<id>" />`, or set
   `featured: true` to use it as the index page.

No component or script change is needed. A service area with no matching
geometry simply draws nothing.

See [data-storage.md](./data-storage.md) for when YAML stops being the right
storage choice.
