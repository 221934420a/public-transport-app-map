# Transport data YAML fields

The YAML files are the editable source of truth for presentation, ticket, and
service-area metadata. Geographic coordinates stay in GeoJSON under `public/geo/`;
YAML refers to those files with `geometry_refs`.

Every record lives in its own YAML file. Astro's `glob()` content loader picks up
new files automatically, so adding an app, map, service area, or ticket does not
require editing `src/content.config.ts`.

```text
src/content/
  apps/
    united-kingdom/              one app per file, grouped by country
    denmark/
  coverage/
    united-kingdom/              one service area per file; an app may have several
    denmark/
  icons/
    united-kingdom/              one app icon per file
    denmark/
  maps/                          one full-screen map shell per country
  tickets/
    united-kingdom/              one ticket per file
    denmark/
public/geo/
  united-kingdom/                one folder per country, referenced as
  denmark/                       /geo/<country>/<file>.geojson; polygon geometry,
  sweden/                        optionally addressed with #feature-id
  norway/
  finland/
  germany/
  france/
  netherlands/
  belgium/
  spain/
  switzerland/
  italy/
  portugal/
  ireland/
  poland/
  czechia/
  austria/
  iceland/
  lithuania/
  latvia/
  estonia/
  hungary/
  slovakia/
  slovenia/
  romania/
  croatia/
  greece/
  bulgaria/
```

Records are grouped by country. The folder is for authoring and review and is not
used as the record ID: the `id` field remains globally unique, so moving a file
between folders does not break references from apps, maps, or tickets. A map
record's `country_code` limits it to that country's apps; leave the field out to
draw every country, which is what the index map does.

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
| `tickets_url` | no | Fares page the "Ticket prices" heading links to when the app has no ticket records, so the panel never shows ticket copy without tickets. Falls back to `website_url`. |
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

A coverage record is one area of an app. Records that no ticket points at are
**base areas**, drawn on the map for the app. Records named in a ticket's
`coverage_ids` are **ticket areas**: they stay hidden until that ticket is
selected, then the map shows them and zooms to them. This lets an app draw one
broad area up front (for example Rejsebillet's nationwide green) and reveal each
City Pass extent only when its pass is opened.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable coverage ID. |
| `app_id` | yes | ID from an app record. |
| `name` | yes | Human-readable name for this service area. |
| `geometry_refs` | yes | One or more GeoJSON paths/feature IDs, e.g. `/geo/united-kingdom/greater-manchester.geojson#greater-manchester`. |
| `style` | no | `fill_color`, `fill_opacity`, `outline_color`, `outline_width` for this block. |
| `boundary_description` | yes | Plain-language definition of the boundary, shown in the panel. |
| `source_url` | yes | Official map or rules for the boundary. |
| `checked_at` | yes | Date last checked. |
| `status` | yes | `draft`, `verified`, or `needs_review`. |
| `sort_order` | no | Drawing order; lower numbers are drawn first. Where areas overlap, the area drawn last stays visible and receives the click. |

Base areas show where the app sells tickets; a ticket's own limits stay in its
`validity_description` (and in the area its `coverage_ids` points at, if any).

```yaml
id: bee-network-service-area
app_id: bee-network
name: Bee Network service area
geometry_refs:
  - /geo/united-kingdom/greater-manchester.geojson#greater-manchester
  - /geo/united-kingdom/bee-network-anybus.geojson
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
| `price_note` | no | Billing-rules text shown instead of "View fares" when there is no single price. |
| `coverage_ids` | no | Coverage areas shown on the map only when this ticket is selected (e.g. a City Pass extent). |
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
their own collections. One record renders one full-screen map: a country shell
draws every service area of that country's apps, and the index shell
(`all-countries.yaml`) leaves `country_code` out and draws every country.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable map ID; must match the filename (e.g. `united-kingdom`). |
| `country_code` | no | ISO 3166-1 alpha-2 country this map covers; only apps for it are drawn. Omit it to draw every app in every country, as the index map does. |
| `title` | yes | Short map title. |
| `eyebrow` | no | Small label above the panel title. |
| `page_title` | no | `<title>` for the standalone page. |
| `meta_description` | no | Meta description for the page. |
| `theme_color` | no | Browser theme colour. |
| `locale` | no | BCP 47 locale used for price formatting; defaults to `en-GB`. |
| `featured` | no | Marks the map used by `src/pages/index.astro`. |
| `map_aria_label` | yes | Accessible name for the map region. |
| `view` | yes | `style_url`, `center`, `zoom`, `max_pitch`, `drag_rotate`. |
| `theme` | yes | `accent`, `accent_strong`, `outline`, `marker_border` colours. |
| `overview` | no | `fill_opacity` and `outline_width` used for areas without their own `style`. |
| `copy` | yes | UI strings. |

### Adding an app

1. Add an app YAML under `src/content/apps/<country>/` (e.g. `united-kingdom/`).
2. Add the official GeoJSON to `public/geo/`.
3. Add `src/content/coverage/<country>/<app>-service-area.yaml` with
   `geometry_refs` (and optional `style`).
4. Add a `src/content/maps/<country>.yaml` shell record with that `country_code`.
5. Add `src/pages/<country>.astro` that renders `<MapPage mapId="<id>" />`. The
   index shell already draws every country, so nothing else is needed to show the
   new records on the home page.

No component or script change is needed. A service area with no matching
geometry simply draws nothing.

See [data-storage.md](./data-storage.md) for when YAML stops being the right
storage choice.
