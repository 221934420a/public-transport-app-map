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
  coverage/
    united-kingdom/        one service area per YAML file
    denmark/               an app may have several (Rejsebillet City Pass areas)
    sweden/
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
  icons/
    united-kingdom/        one app icon per YAML file
    denmark/
    sweden/
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
  maps/                    one shell per map: all-countries.yaml (the index map),
                           united-kingdom.yaml, denmark.yaml, sweden.yaml,
                           norway.yaml, finland.yaml, germany.yaml,
                           france.yaml, netherlands.yaml, belgium.yaml,
                           spain.yaml, switzerland.yaml, italy.yaml, portugal.yaml, ireland.yaml, poland.yaml, czechia.yaml
  tickets/
    united-kingdom/        one ticket per YAML file
    denmark/
    sweden/
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
public/icons/
  pop.png                  raster icon asset used by the Pop app icon record
  rejsebillet.png          official Rejsebillet app icon
  sl.png                   official SL app icon
  skanetrafiken.png        official Skånetrafiken app icon
  vasttrafik.png           official Västtrafik To Go app icon
  <app>.png                one official app icon per icon record; the Swedish,
                           Norwegian, Finnish, German, French, Dutch, Belgian,
                           Spanish, Swiss and Italian operators each have their
                           own file
public/geo/
  united-kingdom/          one folder per country; geometry is referenced as
  denmark/                 /geo/<country>/<file>.geojson
  sweden/
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
```

Data is grouped by country (`united-kingdom/`, `denmark/`, `sweden/`, `norway/`,
`finland/`, `germany/`, `france/`, `netherlands/`, `belgium/`, `spain/`,
`switzerland/`, `italy/`, `portugal/`, `ireland/`, `poland/`, `czechia/`, and later other countries). A map shell with a `country_code` draws that country's apps only;
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
`/norway/`, the Finland map at `/finland/`, the Germany map at `/germany/`, the
France map at `/france/`, the Netherlands map at `/netherlands/`, the Belgium map
at `/belgium/`, the Spain map at `/spain/`, the Switzerland map at
`/switzerland/`, the Italy map at `/italy/`, the Portugal map at `/portugal/`, the Ireland map at `/ireland/`, the Poland map at `/poland/` and the Czechia map at `/czechia/`.

See `docs/data-schema.md` for all fields and `docs/data-storage.md` for guidance
on YAML versus GeoJSON, PMTiles, or a database.

## Simplifying geometry

The map draws every service area, so `public/geo/**/*.geojson` is simplified in
place with [mapshaper](https://mapshaper.org/):

```sh
npm run geo:simplify
```

The script removes 85% of the vertices, rounds coordinates to five decimals and
prints the size change; the whole set drops from about 5.9 MB to 0.7 MB. Feature
ids and properties survive, so `geometry_refs` fragments keep working. It is
meant for full-resolution sources: running it twice simplifies the file again,
and islets under roughly a square kilometre can disappear. Keep pristine
originals outside `public/geo/` (or regenerate them from the sources below) if
you may need them later, and raise `--percent=25` to keep more detail.

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
- **Czech coverage** — for the ten city and regional apps (PID Lítačka for Prague
  and Central Bohemia, ODISapka for the Moravian-Silesian region, MojeDPO for
  Ostrava, the Plzeň card for the Plzeň region, DPMO for Olomouc, Idolka for the
  Liberec region, IREDO for the Hradec Králové and Pardubice regions, DPMCB for
  České Budějovice, Vary Virtual for Karlovy Vary and DÚKapka for the Ústí
  region) the shaded area is the official boundary of the region or city whose
  zone map sets the fares, taken from OpenStreetMap administrative relations and
  dissolved. Each icon is the official Google Play icon, stored as
  `public/icons/<app>.png`.
- **Polish coverage** — for the twelve city and metropolitan apps (Transport GZM
  for the Katowice metropolia, mKraków, PEKA, UrbanCard, System Fala for the
  Tricity, MigAppka, Lubika, Jadę Rzeszów, Często Plus, the Szczecin city card,
  MAM Koszalin and Płockarta) the shaded area is the official boundary of the
  metropolitan area or city whose zone map sets the fares, taken from
  OpenStreetMap administrative relations and simplified. Translink-style
  white-label and third-party platforms (Jakdojade, moBILET, mPay, SkyCash,
  zBiletem, GoPay) are deliberately excluded, and Mint Mobile Bydgoszcz has no
  app-store listing. Each icon is the official Google Play icon, stored as
  `public/icons/<app>.png`.
- **Irish coverage** — for TFI GO and Leap Top-up the shaded area is the Republic
  of Ireland's national boundary: both sell tickets across the national Bus
  Éireann / Local Link and Leap networks rather than a single city zone. Translink
  mLink covers Northern Ireland, so it uses the Northern Ireland boundary and sits
  on the United Kingdom map (country code GB). Each icon is the official Google
  Play icon, stored as `public/icons/<app>.png`.
- **Portuguese coverage** — for the six apps (Anda for the Porto metropolitan
  area, navegante for the Lisbon metropolitan area, CARRISway for Lisbon, TUB
  Mobile for Braga, Vamus Algarve for the Algarve and Carris Metropolitana for
  the Lisbon metropolitan area) the shaded area is the official boundary of the
  metropolitan area, city or region whose zone map sets the fares, taken from
  OpenStreetMap administrative relations and simplified. SIGA and GIROBUS are not
  mapped: neither has an official app listing yet (mobile ticketing is only being
  introduced), and the app-store results are third-party apps. Carris
  Metropolitana is mapped for completeness even though its app is
  information-first — tickets on those suburban buses are still bought on board.
  Each icon is the official Google Play icon, stored as
  `public/icons/<app>.png`.
- **Italian coverage** — for the 19 city and regional apps (ATM Milano, Atac  Roma, GTT TO Move, Unico Campania, Roger, at bus, AVM Venezia, AMT Genova,
  Bresciapp!, ATB Mobile, CTM BusFinder, MyAMAT, AMTS Smart Ticketing, Ticket Bus
  Verona, MooneyGo for Bari and for Ancona, altoadigemobilità, Muoversi in
  Trentino and glimble FVG) the shaded area is the official boundary of the
  authority's zone — the city for the urban operators, the province for South
  Tyrol and Trentino, and the region for Campania, Tuscany and
  Friuli-Venezia Giulia — taken from OpenStreetMap administrative relations and
  simplified. Each icon is the official Google Play icon, stored as
  `public/icons/<app>.png`.
- **Swiss coverage** — for the three networks with their own ticket app (ZVV for
  the canton of Zürich, TNW Tickets for Basel-Stadt and Basel-Landschaft, and tpg
  for the canton of Geneva) the shaded area is the official cantonal boundary,
  which is the tariff area their zone maps cover. **öV Plus**, the cross-network
  app that sells the national direct-traffic tickets, covers the whole country,
  so its shaded area is the Swiss national boundary — which also covers the
  tariff networks that have no app of their own (Libero, Ostwind, Tarifverbund
  Zug, Passepartout, A-Welle, Mobilis, Frimobil, Arcobaleno and Onde Verte). Each
  icon is the official Google Play icon, stored as `public/icons/<app>.png`.
- **Spanish coverage** — for the eight regional apps (T-mobilitat for the
  Barcelona metropolitan area, Mi Tarjeta Transporte for the Comunidad de Madrid,
  RecargaSUMA for the Valencia metropolitan area, TIB Mallorca for Mallorca,
  ten+móvil for Tenerife, CTA CONECTA for Asturias, Mugi APP Gipuzkoa for
  Gipuzkoa and Avanza Zaragoza for Zaragoza) the shaded area is the official
  boundary of the authority's zone — the metropolitan area, island, province or
  region — taken from OpenStreetMap administrative relations and simplified.
  Each icon is the official Google Play icon, stored as
  `public/icons/<app>.png`.
- **Belgian coverage** — for the three regional apps (STIB-MIVB for the
  Brussels-Capital Region, De Lijn for Flanders and TEC for Wallonia) the shaded
  area is the official boundary of that region, the fare-zone area the apps sell
  for, taken from OpenStreetMap administrative relations. Floya, the STIB-led
  Brussels MaaS app, is not mapped: it has been withdrawn from the app stores
  ahead of its shutdown on 31 December 2026, so there is no app icon to use. Each
  icon is the official Google Play icon, stored as `public/icons/<app>.png`.
- **Dutch coverage** — for the ten regional operators (GVB for Amsterdam, RET
  for Rotterdam, HTM for The Hague, U-OV for the province of Utrecht, RRReis for
  Gelderland, RRReis/Keolis for Overijssel and Flevoland, Arriva for Limburg,
  MeerPlus/EBS for Zaanstreek-Waterland, @Transdev for Zeeland and Glimble for
  Arriva's concessions) the shaded area is the **official boundary of the
  concession area** — the city for the municipal operators, the province (or the
  union of provinces for Glimble) for the provincial concessions, and the seven
  member municipalities for MeerPlus — taken from OpenStreetMap administrative
  relations and dissolved into one outline. Each icon is the official Google Play
  icon, stored as `public/icons/<app>.png`. allGo (Keolis, Almere) is not mapped:
  it has no app-store listing, only a webshop.
- **French metropolitan and regional coverage** — for the 34 networks in scope
  (Bonjour RATP for Île-de-France, TCL E-Ticket, RTM, Tisséo, Lignes d'Azur,
  M'Ticket, Naolib, STAR, TBM, Irigo, Setram, TAO Orléans, Divia Mobilités, CTS
  Strasbourg, ilévia, My Astuce, Twisto, Grand Reims Mobilités, L'Appli M,
  Moovizy, Réseau Mistral, Orizo, Soléa, Sibra, Transvilles, Vitalis, LE MET'
  mobilités, liO Occitanie, Atoumod, Modalis, Rémi, Wop m-ticket/Aléop, Allez
  ZOU! and BreizhGo) the shaded area is the **official boundary of the AOM that
  sets the fares** — the région for the regional apps and Île-de-France, the
  métropole / agglomération for the metropolitan ones — taken from OpenStreetMap
  administrative relations and simplified. Each icon is the official Google Play
  icon, stored as `public/icons/<app>.png`.
- **German city and regional coverage** — for the 39 German operators and
  associations (BVG, VBB, hvv, MVGO, VGN, VVS, RMVgo, KVB, BONNmobil, Rheinbahn,
  ZÄPP, DOtick, ÜSTRA, FahrPlaner, LeipzigMOVE, DVB, KVV, naveo, rnv, VAG mobil,
  Saarfahrplan, NAH SH, ViP, MVB, Erfurt mobil, movemix, NVV, Meine BSVG, movA,
  moBiel YOU, CVAGapp, VRM, VVM, RVV, VOSpilot, VRT mobil, VGI and unser-DING) the
  shaded area is the **official boundary of the districts and cities that make up
  that authority's fare-zone area** — the city itself for the municipal operators,
  the member Kreise for the Verbünde, and the Bundesland where the association
  covers it (Berlin + Brandenburg, North Rhine-Westphalia, Schleswig-Holstein,
  Saarland). Boundaries come from OpenStreetMap administrative relations and the
  German district dataset, dissolved into one outline per app, so the shapes match
  the zone maps the apps sell tickets for. Each icon is the official Google Play
  icon, stored as `public/icons/<app>.png`.
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
Merseyside. The Greater Manchester file is the most detailed source (about
750 KB before `npm run geo:simplify` shrinks it to about 60 KB).

Review OpenFreeMap's current terms and service status before relying on its
public instance in production.
