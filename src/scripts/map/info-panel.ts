import { el, withSlot } from './dom';
import { createFormatters, fillTemplate } from './format';
import type { TicketOverlay } from './ticket-overlay';
import type { App, AppIcon, Coverage, ShellData, Ticket } from './types';

export const createInfoPanel = (options: {
  root: HTMLElement;
  elements: {
    panel: HTMLElement;
    title: HTMLElement;
    eyebrow: HTMLElement | null;
    icon: HTMLElement;
    content: HTMLElement;
    back: HTMLElementTagNameMap['md-icon-button'];
    close: HTMLElementTagNameMap['md-icon-button'];
  };
  data: ShellData;
  appById: Map<string, App>;
  ticketOverlay: TicketOverlay;
}) => {
  const { root, elements, data, appById, ticketOverlay } = options;
  const {
    panel,
    title: panelTitle,
    eyebrow: panelEyebrow,
    icon: panelIcon,
    content: panelContent,
    back: panelBack,
    close: panelClose,
  } = elements;
  const { shell } = data;
  const copy = shell.copy;
  const { formatMoney, formatDuration } = createFormatters(shell.locale);

  let currentApp: App | null = null;
  let currentCoverage: Coverage | undefined;
  let currentTicketId: string | null = null;

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

  const showIntro = () => {
    currentApp = null;
    currentCoverage = undefined;
    currentTicketId = null;
    ticketOverlay.clear();
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
    ticketOverlay.clear();
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
      void ticketOverlay.show(ticket, ticketCoverages);
    } else {
      ticketOverlay.clear();
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
    else showIntro();
  });
  panelClose.addEventListener('click', () => {
    panel.hidden = true;
    showIntro();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) panelClose.click();
  });

  return {
    openApp,
    isOpen: () => !panel.hidden,
    showIntro,
  };
};
