# Public Transport Map

A minimal Astro site with a full-screen MapLibre map. The map is **app-centred**:
each app has one service area whose boundary is drawn from official GeoJSON and
may extend beyond administrative boundaries. Selecting a coloured area or its
marker opens the panel; ticket prices link to their official source.

## Run locally

Use Node.js 22.23.4 or later, then run:

```sh
npm install
npm run dev
```

The basemap uses OpenFreeMap's Positron style. MapLibre displays the required
OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution automatically.

## Data layout

```text
src/content/
  apps/                    one app per YAML file
  coverage/
    greater-manchester/    one service area per YAML file (region folders)
    liverpool/
    london/
    south-yorkshire/
    west-midlands/
    west-yorkshire/
  icons/                   one app icon per YAML file
  maps/                    one map shell per YAML file
  tickets/
    greater-manchester/    one ticket per YAML file
    liverpool/
    london/
    south-yorkshire/
    west-midlands/
    west-yorkshire/
public/geo/
  *.geojson                geometry referenced by geometry_refs
```

The region folder under `coverage/` and `tickets/` is for organising data by
geographic dataset. Record IDs remain global, so `app_id` and `geometry_refs`
do not change when a record moves between region folders.

App icons are also data: `apps/<id>.yaml` sets `icon_id`, and the matching
`src/content/icons/<id>.yaml` supplies the SVG markup. `AppIcon.astro` contains
no app-specific artwork.

Presentation and facts are separate. A coverage record is one app's service
area: its `geometry_refs` point at the official polygons drawn as that app's
coloured area, and the map draws **every** coverage record whose `app_id`
matches the map's app. Adding an app usually needs only:

1. an app YAML under `src/content/apps/`;
2. a `coverage/<region>/<app>-service-area.yaml` with `geometry_refs` (and an
   optional `style`);
3. a `maps/<id>.yaml` shell record, plus a page that renders it, e.g.
   `src/pages/<id>.astro` containing `<MapPage mapId="<id>" />` (or set
   `featured: true` on the shell to use it as the index page).

`src/layouts/MapPage.astro` resolves the shell, app, icon, service areas, and
tickets for a map. The index page renders the featured shell; the Saveaway map
for Liverpool is at `/metrosmart/`.

See `docs/data-schema.md` for all fields and `docs/data-storage.md` for guidance
on YAML versus GeoJSON, PMTiles, or a database.

## Geometry sources

- **Greater Manchester boundary** — the public [Greater Manchester Boundary
  feature service](https://services-eu1.arcgis.com/TSkUZPV4pvisWowL/ArcGIS/rest/services/GM_Boundary/FeatureServer/0).
- **Bee Network AnyBus outer areas** — the TfGM `AnyBus_Ticketmap_Boundary`
  feature service, linked from the [Greater Manchester and AnyBus boundary
  page](https://tfgm.com/public-transport/maps/greater-manchester-bus-boundary-map/anybus).
  Contains OS data © Crown copyright and database rights 2025 OS AC0000850590.
- **Merseyside coverage** — built from NaPTAN stop locations (ATCO area 280: all
  bus stops, bus stations, rail station entrances and ferry terminals), so the
  shaded area covers the whole Merseyside bus and rail network. Regenerate from
  `naptan.api.dft.gov.uk/v1/access-nodes?atcoAreaCodes=280&dataFormat=CSV`. The
  app icon reproduces the Merseytravel Journey Planner app icon (yellow field,
  grey disc, yellow M).
- **Saveaway rail extensions** — Ormskirk, Chester and Ellesmere Port built-up
  areas from the ONS [Built Up Areas (December 2024)](https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0)
  service. Contains OS and ONS data.
- **TfL coverage** — built from the stop locations in the TfL StopPoint API (all
  bus stops and Underground stations) so the shaded area covers the whole reach
  of those modes. Regenerate `public/geo/tfl-coverage.geojson` from
  `api.tfl.gov.uk/StopPoint/Mode/bus?page=N` (32k+ stops) and
  `api.tfl.gov.uk/StopPoint/Mode/tube`. The app icon reproduces the TfL Go app
  icon (white roundel on TfL blue).

- **TfWM coverage** — built from NaPTAN ATCO area 430 (all TfWM-managed bus
  stops, bus stations and West Midlands Metro tram stops). Regenerate from
  `naptan.api.dft.gov.uk/v1/access-nodes?atcoAreaCodes=430&dataFormat=CSV`. The
  app icon reproduces the TfWM app icon (white motif on dark purple).
- **West Yorkshire coverage** — built from NaPTAN ATCO area 450 (all West
  Yorkshire bus stops, bus stations and rail station entrances). Regenerate from
  `naptan.api.dft.gov.uk/v1/access-nodes?atcoAreaCodes=450&dataFormat=CSV`. The
  app icon reproduces the MCard Mobile app icon (white tag with M on black).
- **South Yorkshire coverage** — built from NaPTAN ATCO area 370 (all Travel
  South Yorkshire bus stops, bus stations, tram stops and rail station
  entrances). Regenerate from
  `naptan.api.dft.gov.uk/v1/access-nodes?atcoAreaCodes=370&dataFormat=CSV`. The
  app icon reproduces the TravelMaster app icon (tricolour triangle).

A service area may extend beyond administrative boundaries: bee-network's area
is the Greater Manchester boundary plus the AnyBus outer areas around Preston
and East Lancashire, and the Saveaway area adds the rail-only extensions beyond
Merseyside. The Greater Manchester file is detailed (about 750 KB); simplify it
with a GIS tool before relying on it at scale.

Review OpenFreeMap's current terms and service status before relying on its
public instance in production.
