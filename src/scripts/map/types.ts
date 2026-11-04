export type Coordinate = [number, number];

export type AreaStyle = {
  fill_color?: string;
  fill_opacity?: number;
  outline_color?: string;
  outline_width?: number;
};

export type Coverage = {
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

export type AppIcon = {
  view_box: string;
  class?: string;
  svg: string;
};

export type App = {
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

export type Ticket = {
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

export type ShellCopy = {
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

export type MapShell = {
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

export type ShellData = {
  shell: MapShell;
  apps: App[];
  coverages: Coverage[];
  tickets: Ticket[];
};
