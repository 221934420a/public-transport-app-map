# Public Transport Map

A minimal Astro site with a full-screen MapLibre map. The map is **app-centred**:
each app has one or more service areas whose boundaries are drawn from official
GeoJSON and may extend beyond administrative boundaries. Selecting a coloured
area or its marker opens the panel; ticket prices link to their official source.

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
  apps/
    united-kingdom/        one app per YAML file, grouped by country
    denmark/
    sweden/
    norway/
    finland/
  coverage/
    united-kingdom/        one service area per YAML file
    denmark/               an app may have several (Rejsebillet City Pass areas)
    sweden/
    norway/
    finland/
  icons/
    united-kingdom/        one app icon per YAML file
    denmark/
    sweden/
    norway/
    finland/
  maps/                    one shell per map: all-countries.yaml (the index map),
                           united-kingdom.yaml, denmark.yaml, sweden.yaml,
                           norway.yaml, finland.yaml
  tickets/
    united-kingdom/        one ticket per YAML file
    denmark/
    sweden/
    norway/
    finland/
public/icons/
  pop.png                  raster icon asset used by the Pop app icon record
  rejsebillet.png          official Rejsebillet app icon
  sl.png                   official SL app icon
  skanetrafiken.png        official Skånetrafiken app icon
  vasttrafik.png           official Västtrafik To Go app icon
  <app>.png                one official app icon per icon record; the Swedish,
                           Norwegian and Finnish regional operators each have
                           their own file
public/geo/
  united-kingdom/          one folder per country; geometry is referenced as
  denmark/                 /geo/<country>/<file>.geojson
  sweden/
  norway/
  finland/
```

Data is grouped by country (`united-kingdom/`, `denmark/`, `sweden/`, `norway/`,
`finland/`, and later other countries). A map shell with a `country_code` draws that country's apps only;
`all-countries.yaml` leaves it out and draws **every** app, which is what the
index page uses, so a new country appears on the home page as soon as its
records exist. Record IDs remain global, so `app_id` and `geometry_refs` do not
change when a record moves between folders.

App icons are also data: `apps/<id>.yaml` sets `icon_id`, and the matching
`src/content/icons/<id>.yaml` supplies the SVG markup. `AppIcon.astro` contains
no app-specific artwork.

Presentation and facts are separate. A coverage record is one area of an app,
and its `geometry_refs` point at the official polygons. Records that no ticket
points at are **base areas** drawn on the map; records named in a ticket's
`coverage_ids` stay hidden until that ticket is selected, when the map shows and
zooms to them. So Rejsebillet draws a single green nationwide area up front and
reveals each City Pass extent only when its pass is opened.

An app with no ticket records links its "Ticket prices" heading straight to its
`tickets_url` (falling back to `website_url`), so the panel never shows
"Select a ticket..." copy with nothing under it. Adding an app usually needs only:

1. an app YAML under `src/content/apps/`;
2. a `coverage/<country>/<app>-service-area.yaml` with `geometry_refs` (and an
   optional `style`);
3. a `maps/<id>.yaml` shell record, plus a page that renders it, e.g.
   `src/pages/<id>.astro` containing `<MapPage mapId="<id>" />`. The index shell
   draws every country, so the new records appear on the home page without
   further changes.

`src/layouts/MapPage.astro` resolves the shell, app, icon, service areas, and
tickets for a map. The index page renders the all-countries shell; each country
also has its own path, for example the United Kingdom map at `/united-kingdom/`,
the Denmark map at `/denmark/`, the Sweden map at `/sweden/`, the Norway map at
`/norway/` and the Finland map at `/finland/`.

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
  of those modes. Regenerate `public/geo/united-kingdom/tfl-coverage.geojson` from
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
- **Tyne and Wear coverage** — NaPTAN ATCO area 410 (bus stops and stations) plus
  the Tyne and Wear Metro stations (national tram data, ATCO 940) and the rail
  stations within the area (ATCO 910). The Pop app icon is the official rainbow
  "Pop" icon, stored as `public/icons/pop.png`.
- **Västra Götaland coverage** — the position of every Västtrafik bus stop, tram
  stop and rail station in Västra Götaland (OpenStreetMap via the Overpass API:
  `node[highway=bus_stop]`, `node[railway=tram_stop]` and `node[railway=station]`
  inside `ISO3166-2=SE-O`), plus the same stop types in a bounding box around
  Kungsbacka, which Västtrafik also serves. The points are gridded at 0.04°,
  dilated, dissolved and smoothed into one outline. The Västtrafik To Go app icon
  is the official Google Play icon, stored as `public/icons/vasttrafik.png`.
- **Stockholm coverage** — every SL bus stop, tram stop, metro and rail station
  and ferry pier in Stockholm County (OpenStreetMap via the Overpass API:
  `node[highway=bus_stop]`, `node[railway=tram_stop]`, `node[railway=station]` and
  `node[amenity=ferry_terminal]` inside `ISO3166-2=SE-AB`). The points are gridded
  at 0.02°, dilated, dissolved and smoothed into one outline that follows the
  county and reaches the archipelago piers at Sandhamn. The SL app icon is the
  official Google Play icon, stored as `public/icons/sl.png`.
- **Skåne coverage** — every Skånetrafiken bus stop, tram stop, rail station and
  ferry pier in Skåne (OpenStreetMap via the Overpass API:
  `node[highway=bus_stop]`, `node[railway=tram_stop]`, `node[railway=station]` and
  `node[amenity=ferry_terminal]` inside `ISO3166-2=SE-M`). The points are gridded
  at 0.02°, dilated, dissolved and smoothed into one outline. The Skånetrafiken
  app icon is the official Google Play icon, stored as
  `public/icons/skanetrafiken.png`.
- **Swedish regional coverage** — for the 18 regional operators (UL,
  Sörmlandstrafiken, Östgötatrafiken, Jönköpings Länstrafik, Länstrafiken
  Kronoberg, Kalmar länstrafik, Gotlands Kollektivtrafik, Blekingetrafiken,
  Hallandstrafiken, Värmlandstrafik, Länstrafiken Örebro, VL, Dalatrafik,
  X-trafik, Din Tur, Länstrafiken Jämtland, Tabussen.nu and Länstrafiken
  Norrbotten) the service area is built from every bus stop, tram stop, rail
  station and ferry pier in that operator's county (OpenStreetMap via the
  Overpass API: `node[highway=bus_stop]`, `node[railway=tram_stop]`,
  `node[railway=station]` and `node[amenity=ferry_terminal]` inside the county's
  `ISO3166-2=SE-*` area). Each county's points are gridded at 0.02°, dilated,
  dissolved and smoothed into one outline. Each icon is the official Google Play
  icon, stored as `public/icons/<app>.png`.
- **Norwegian regional coverage** — for the 12 regional operators (Ruter for Oslo
  and Akershus, ØstfoldBillett, Brakar, VKT, Farte, AKT Billett, Kolumbus Billett,
  Skyss, AtB, Reis, Svipper and Snelandia Mobillett) the service area is built from
  every bus stop, tram stop, rail station and ferry pier in that operator's county
  or counties (OpenStreetMap via the Overpass API, `ISO3166-2=NO-*`), gridded at
  0.02°, dilated, dissolved and smoothed into one outline. Each icon is the official
  Google Play icon, stored as `public/icons/<app>.png`.
- **Finnish regional coverage** — for the seven regional operators and cities in
  scope (HSL for the nine Helsinki-region municipalities, Waltti Mobiili for the
  Waltti cities, Föli for the Turku region, OSL for the Oulu region, CityApp for
  Seinäjoki, Seutu+ for Varsinais-Suomi and Satakunta, and PayiQ Tickets for
  Åland) the service area is built from every bus stop, tram stop, rail station
  and ferry pier inside those municipalities or regions (OpenStreetMap via the
  Overpass API), gridded at 0.02°, dilated, dissolved and smoothed into one
  outline per app. Each icon is the official Google Play icon, stored as
  `public/icons/<app>.png`. Municipalities are matched by name, and names such as
  Rusko or Kerava also exist outside the intended region, so each app's points are
  clipped to the box that actually contains its network.
- **Denmark coverage** — the [Natural Earth](https://www.naturalearthdata.com/)
  1:10m admin-0 country outline for Denmark, rounded to five decimals, used as the
  Rejsebillet service area because the app sells tickets in every Danish fare
  area.
- **City Pass areas** — the fare zone geometry behind DOT's zone and commuter
  maps (`pendlerzoner.dinoffentligetransport.dk/resources/takstzoner_202407_2.geojson`),
  one `ZoneID` per fare zone. Zones 1-4, 1-99, 101-199 and 201-299 are dissolved
  into one outline each for City Pass Small, Large, West and South; City Pass
  X-Large is the same three larger areas drawn together, so it needs no extra
  geometry. The app icon is the official Rejsebillet app icon, stored as
  `public/icons/rejsebillet.png`.

A service area may extend beyond administrative boundaries: bee-network's area
is the Greater Manchester boundary plus the AnyBus outer areas around Preston
and East Lancashire, and the Saveaway area adds the rail-only extensions beyond
Merseyside. The Greater Manchester file is detailed (about 750 KB); simplify it
with a GIS tool before relying on it at scale.

Review OpenFreeMap's current terms and service status before relying on its
public instance in production.
