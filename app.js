/* SkyControl — dane demonstracyjne. Aplikacja działa także pod adresem file://. */
(() => {
  'use strict';

  const TIME_ZONE = 'Europe/Warsaw';
  const OPERATIONS_KEY = 'skycontrol.operations.v1';
  const THEME_KEY = 'skycontrol.theme.v1';
  const HISTORY_LIMIT = 30;
  const STATUS = Object.freeze({ planned: 'Planowany', active: 'W trakcie', completed: 'Zakończony' });
  const SAMPLE_FLIGHTS = [
    { id: 'lo281', number: 'LO 281', airline: 'LOT Polish Airlines', mark: 'LO', city: 'Londyn', code: 'LHR', country: 'Wielka Brytania', time: '06:20', gate: 'A04', status: 'completed' },
    { id: 'lh1347', number: 'LH 1347', airline: 'Lufthansa', mark: 'LH', city: 'Frankfurt', code: 'FRA', country: 'Niemcy', time: '07:05', gate: 'A12', status: 'completed' },
    { id: 'af1247', number: 'AF 1247', airline: 'Air France', mark: 'AF', city: 'Paryż', code: 'CDG', country: 'Francja', time: '07:40', gate: 'A08', status: 'completed' },
    { id: 'kl1314', number: 'KL 1314', airline: 'KLM Royal Dutch Airlines', mark: 'KL', city: 'Amsterdam', code: 'AMS', country: 'Holandia', time: '08:30', gate: 'A16', status: 'active' },
    { id: 'lo301', number: 'LO 301', airline: 'LOT Polish Airlines', mark: 'LO', city: 'Rzym', code: 'FCO', country: 'Włochy', time: '09:10', gate: 'A02', status: 'active' },
    { id: 'fr6072', number: 'FR 6072', airline: 'Ryanair', mark: 'FR', city: 'Barcelona', code: 'BCN', country: 'Hiszpania', time: '10:15', gate: 'A20', status: 'active' },
    { id: 'lo481', number: 'LO 481', airline: 'LOT Polish Airlines', mark: 'LO', city: 'Oslo', code: 'OSL', country: 'Norwegia', time: '11:00', gate: 'A06', status: 'planned' },
    { id: 'ay1142', number: 'AY 1142', airline: 'Finnair', mark: 'AY', city: 'Helsinki', code: 'HEL', country: 'Finlandia', time: '12:25', gate: 'A14', status: 'planned' },
    { id: 'lo225', number: 'LO 225', airline: 'LOT Polish Airlines', mark: 'LO', city: 'Wiedeń', code: 'VIE', country: 'Austria', time: '13:40', gate: 'A10', status: 'planned' },
    { id: 'lx1353', number: 'LX 1353', airline: 'Swiss International', mark: 'LX', city: 'Zurych', code: 'ZRH', country: 'Szwajcaria', time: '15:10', gate: 'A18', status: 'planned' }
  ];

  const byId = (id) => document.getElementById(id);
  const refs = {
    tbody: byId('flights-body'), search: byId('flight-search'), clearSearch: byId('clear-search'),
    tabs: [...document.querySelectorAll('[data-filter]')], details: byId('details-dialog'),
    history: byId('history-dialog'), help: byId('help-dialog'), toast: byId('toast'),
    sidebar: byId('sidebar'), backdrop: byId('sidebar-backdrop'), menu: byId('menu-button'),
    shell: document.querySelector('.app-shell')
  };
  const mobileQuery = window.matchMedia('(max-width: 760px)');
  const dialogOpeners = new WeakMap();
  const state = { flights: [], history: [], filter: 'all', query: '', ascending: true, detailId: null };
  let storageFailed = false;
  let corruptSave = false;
  let toastTimer;
  let sidebarOpen = false;
  let lastDate = '';
  let navigationFrame = 0;

  const dateFormatter = new Intl.DateTimeFormat('pl-PL', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' });
  const clockFormatter = new Intl.DateTimeFormat('pl-PL', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const shortDateFormatter = new Intl.DateTimeFormat('pl-PL', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
  const historyFormatter = new Intl.DateTimeFormat('pl-PL', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function icon(name, className = 'icon') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function reportStorageFailure() {
    storageFailed = true;
    byId('storage-warning').hidden = false;
    byId('save-indicator').classList.add('save-error');
    byId('save-label').textContent = 'Zmiany tylko w bieżącej sesji — zapis niedostępny';
  }

  function readStorage(key) {
    try { return localStorage.getItem(key); }
    catch (error) { reportStorageFailure(); return null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (error) { reportStorageFailure(); return false; }
  }

  function restoreOperations() {
    let saved = null;
    const raw = readStorage(OPERATIONS_KEY);
    if (raw !== null) {
      try {
        saved = JSON.parse(raw);
        if (!saved || saved.version !== 1 || typeof saved.statuses !== 'object' || saved.statuses === null || Array.isArray(saved.statuses)) {
          saved = null;
          corruptSave = true;
        }
      } catch (error) { corruptSave = true; }
    }
    // Odczytujemy wyłącznie znane rejsy i dozwolone statusy.
    state.flights = SAMPLE_FLIGHTS.map((flight) => ({
      ...flight,
      status: saved && Object.hasOwn(saved.statuses, flight.id) && typeof saved.statuses[flight.id] === 'string' && Object.hasOwn(STATUS, saved.statuses[flight.id]) ? saved.statuses[flight.id] : flight.status
    }));
    state.history = saved && Array.isArray(saved.history) ? saved.history.filter((entry) => (
      entry && SAMPLE_FLIGHTS.some((flight) => flight.id === entry.flightId) &&
      typeof entry.from === 'string' && typeof entry.to === 'string' && Object.hasOwn(STATUS, entry.from) && Object.hasOwn(STATUS, entry.to) &&
      typeof entry.at === 'number' && Number.isFinite(entry.at) && entry.at > 0 && entry.at <= 8640000000000000
    )).map(({ flightId, from, to, at }) => ({ flightId, from, to, at })).slice(0, HISTORY_LIMIT) : [];
  }

  function saveOperations() {
    const statuses = Object.fromEntries(state.flights.map((flight) => [flight.id, flight.status]));
    return writeStorage(OPERATIONS_KEY, JSON.stringify({ version: 1, statuses, history: state.history }));
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    byId('toast-message').textContent = message;
    refs.toast.hidden = false;
    toastTimer = window.setTimeout(() => { refs.toast.hidden = true; }, 5500);
  }

  function applyTheme(theme, persist = false) {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    const label = light ? 'Włącz ciemny motyw' : 'Włącz jasny motyw';
    byId('theme-button').setAttribute('aria-label', label);
    byId('theme-button').setAttribute('title', label);
    byId('theme-button').setAttribute('aria-pressed', String(light));
    byId('theme-icon').setAttribute('href', light ? '#i-moon' : '#i-sun');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#f3f6fb' : '#0c111b');
    if (persist) writeStorage(THEME_KEY, light ? 'light' : 'dark');
  }

  function updateClock() {
    const now = new Date();
    const date = dateFormatter.format(now);
    byId('clock').textContent = clockFormatter.format(now);
    byId('clock').dateTime = now.toISOString();
    byId('clock').setAttribute('title', 'Aktualny czas w Warszawie (Europe/Warsaw)');
    if (date !== lastDate) {
      lastDate = date;
      byId('current-date').textContent = date;
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const getPart = (type) => parts.find((part) => part.type === type).value;
      byId('current-date').dateTime = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
      byId('copyright-year').textContent = getPart('year');
      if (refs.details.open) byId('details-date').textContent = shortDateFormatter.format(now);
    }
  }

  function renderSummary() {
    const counts = { all: state.flights.length, planned: 0, active: 0, completed: 0 };
    state.flights.forEach((flight) => { counts[flight.status] += 1; });
    Object.keys(counts).forEach((key) => {
      byId(`count-${key}`).textContent = counts[key];
      byId(`tab-${key}`).textContent = counts[key];
      if (key !== 'all') byId(`legend-${key}`).textContent = counts[key];
    });
    const percentage = counts.all ? Math.round(counts.completed / counts.all * 100) : 0;
    byId('completion-chip').textContent = `${percentage}% PLANU`;
    byId('progress-percent').replaceChildren(document.createTextNode(String(percentage)), create('span', '', '%'));
    byId('progress-ring').style.strokeDashoffset = String(100 - percentage);
    byId('progress-chart').setAttribute('aria-label', `Zakończono ${counts.completed} z ${counts.all} lotów, ${percentage} procent planu`);
    byId('progress-summary').replaceChildren(create('strong', '', `${counts.completed} z ${counts.all} lotów`), document.createTextNode(' już za nami'));
    byId('board-total').textContent = counts.all;
    document.querySelector('.nav-count').textContent = counts.all;
  }

  function normalize(text) {
    return String(text).toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  }

  function getVisibleFlights() {
    const words = normalize(state.query).trim().split(/\s+/).filter(Boolean);
    return state.flights.filter((flight) => {
      if (state.filter !== 'all' && flight.status !== state.filter) return false;
      const haystack = normalize([flight.number, flight.number.replace(/\s/g, ''), flight.city, flight.code, flight.country, flight.airline, flight.time, flight.gate, STATUS[flight.status], 'WAW Warszawa Chopina'].join(' '));
      return words.every((word) => haystack.includes(word));
    }).sort((a, b) => (state.ascending ? 1 : -1) * a.time.localeCompare(b.time));
  }

  function createFlightRow(flight) {
    const row = create('tr');
    row.dataset.flightId = flight.id;
    const identityCell = create('td');
    const identity = create('div', 'flight-identity');
    const mark = create('span', `airline-mark ${flight.mark.toLowerCase()}`, flight.mark);
    mark.setAttribute('aria-hidden', 'true');
    const labels = create('div');
    labels.append(create('span', 'flight-number', flight.number), create('span', 'cell-subtitle', flight.airline));
    identity.append(mark, labels);
    identityCell.append(identity);

    const destinationCell = create('td');
    destinationCell.append(create('span', 'destination-name', flight.city));
    const destinationDetail = create('span', 'cell-subtitle');
    destinationDetail.append(create('span', 'destination-code', flight.code), document.createTextNode(` · ${flight.country}`));
    destinationCell.append(destinationDetail);
    const timeCell = create('td');
    const time = create('time', 'departure-time', flight.time);
    time.dateTime = flight.time;
    timeCell.append(time, create('span', 'time-caption', 'WAW'));
    const gateCell = create('td');
    gateCell.append(create('span', 'gate-pill', flight.gate));

    const statusCell = create('td');
    const control = create('div', `status-control status-${flight.status}`);
    const select = create('select', 'status-select');
    select.dataset.flightId = flight.id;
    select.setAttribute('aria-label', `Status lotu ${flight.number} do: ${flight.city}`);
    Object.entries(STATUS).forEach(([value, label]) => {
      const option = create('option', '', label);
      option.value = value;
      select.append(option);
    });
    select.value = flight.status;
    control.append(select, icon('down'));
    statusCell.append(control);
    const detailCell = create('td');
    const detailsButton = create('button', 'icon-button row-details');
    detailsButton.type = 'button';
    detailsButton.dataset.detailsId = flight.id;
    detailsButton.setAttribute('aria-label', `Szczegóły lotu ${flight.number} do: ${flight.city}`);
    detailsButton.setAttribute('title', 'Zobacz szczegóły lotu');
    detailsButton.append(icon('chevron'));
    detailCell.append(detailsButton);
    row.append(identityCell, destinationCell, timeCell, gateCell, statusCell, detailCell);
    return row;
  }

  function renderFlights() {
    const visible = getVisibleFlights();
    const fragment = document.createDocumentFragment();
    visible.forEach((flight) => fragment.append(createFlightRow(flight)));
    refs.tbody.replaceChildren(fragment);
    byId('empty-state').hidden = visible.length > 0;
    byId('results-count').textContent = `Wyświetlono ${visible.length} z ${state.flights.length} lotów`;
    byId('empty-description').textContent = state.query.trim() ? `Brak wyników dla „${state.query.trim()}”. Spróbuj innego kierunku lub wyczyść filtry.` : 'W tej kategorii nie ma teraz lotów. Wybierz inny status lub pokaż wszystkie.';
    refs.clearSearch.hidden = !state.query;
    byId('search-shortcut').hidden = Boolean(state.query);
    refs.tabs.forEach((tab) => {
      const active = tab.dataset.filter === state.filter;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
  }

  function changeStatus(id, nextStatus, restoreFocus = false) {
    const flight = state.flights.find((item) => item.id === id);
    if (!flight || !Object.hasOwn(STATUS, nextStatus) || flight.status === nextStatus) return;
    state.history.unshift({ flightId: id, from: flight.status, to: nextStatus, at: Date.now() });
    state.history = state.history.slice(0, HISTORY_LIMIT);
    flight.status = nextStatus;
    const saved = saveOperations();
    renderSummary();
    renderFlights();
    if (state.detailId === id) byId('details-status').value = nextStatus;
    if (restoreFocus) {
      const replacement = refs.tbody.querySelector(`select[data-flight-id="${id}"]`);
      (replacement || refs.tabs.find((tab) => tab.dataset.filter === state.filter)).focus({ preventScroll: true });
    }
    showToast(`${flight.number} → ${STATUS[nextStatus]}.${saved ? ' Zapisano zmianę.' : ' Zmiana tylko w tej sesji.'}`);
  }

  function renderHistory() {
    const list = byId('history-list');
    list.replaceChildren();
    if (state.history.length === 0) {
      const empty = create('li', 'history-empty', 'Tu pojawią się Twoje zmiany. Zmień status dowolnego lotu na tablicy, aby rozpocząć dziennik.');
      list.append(empty);
      return;
    }
    state.history.forEach((entry) => {
      const flight = state.flights.find((item) => item.id === entry.flightId);
      const item = create('li', 'history-item');
      const badge = create('span', 'history-icon');
      badge.append(icon('history'));
      const text = create('div', 'history-description');
      text.append(create('strong', '', `${flight.number} · ${flight.city}`), create('p', '', `${STATUS[entry.from]} → ${STATUS[entry.to]}`));
      const time = create('time', '', `${historyFormatter.format(new Date(entry.at))} · czas Warszawy`);
      time.dateTime = new Date(entry.at).toISOString();
      text.append(time);
      item.append(badge, text);
      list.append(item);
    });
  }

  function openDialog(dialog) {
    dialogOpeners.set(dialog, sidebarOpen && mobileQuery.matches ? refs.menu : document.activeElement);
    closeSidebar(false);
    dialog.showModal();
    document.body.classList.add('modal-open');
  }

  function openDetails(id) {
    const flight = state.flights.find((item) => item.id === id);
    if (!flight) return;
    state.detailId = id;
    byId('details-title').textContent = `Lot ${flight.number}`;
    byId('details-airline').textContent = flight.airline;
    ['code', 'city', 'time', 'gate', 'country'].forEach((key) => { byId(`details-${key}`).textContent = flight[key]; });
    byId('details-date').textContent = shortDateFormatter.format(new Date());
    byId('details-status').value = flight.status;
    openDialog(refs.details);
  }

  function closeSidebar(restoreFocus = true) {
    const wasOpen = sidebarOpen;
    sidebarOpen = false;
    refs.sidebar.classList.remove('is-open');
    refs.backdrop.hidden = true;
    refs.menu.setAttribute('aria-expanded', 'false');
    refs.menu.setAttribute('aria-label', 'Otwórz menu');
    refs.shell.inert = false;
    refs.sidebar.inert = mobileQuery.matches;
    document.body.classList.remove('menu-open');
    if (wasOpen && restoreFocus) refs.menu.focus({ preventScroll: true });
  }

  function openSidebar() {
    sidebarOpen = true;
    refs.sidebar.inert = false;
    refs.sidebar.classList.add('is-open');
    refs.backdrop.hidden = false;
    refs.menu.setAttribute('aria-expanded', 'true');
    refs.menu.setAttribute('aria-label', 'Zamknij menu');
    refs.shell.inert = true;
    document.body.classList.add('menu-open');
    byId('sidebar-close').focus({ preventScroll: true });
  }

  function updateNavigation() {
    navigationFrame = 0;
    const atBoard = byId('flight-board').getBoundingClientRect().top <= 130;
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const active = link.dataset.nav === (atBoard ? 'flight-board' : 'overview');
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
  }

  function exportFlights() {
    const rows = [['Rejs', 'Linia lotnicza', 'Kierunek', 'Kod lotniska', 'Odlot (czas Warszawy)', 'Bramka', 'Status']];
    state.flights.forEach((flight) => rows.push([flight.number, flight.airline, flight.city, flight.code, flight.time, flight.gate, STATUS[flight.status]]));
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = create('a');
    link.href = url;
    link.download = `SkyControl-loty-${byId('current-date').dateTime}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    showToast('Zestawienie wszystkich 10 lotów jest gotowe do pobrania.');
  }

  // Interakcje na tablicy.
  refs.search.addEventListener('input', () => { state.query = refs.search.value; renderFlights(); });
  refs.clearSearch.addEventListener('click', () => { state.query = ''; refs.search.value = ''; renderFlights(); refs.search.focus(); });
  byId('reset-filters').addEventListener('click', () => { state.query = ''; state.filter = 'all'; refs.search.value = ''; renderFlights(); refs.search.focus(); });
  refs.tabs.forEach((tab) => tab.addEventListener('click', () => { state.filter = tab.dataset.filter; renderFlights(); }));
  byId('sort-button').addEventListener('click', () => {
    state.ascending = !state.ascending;
    byId('time-heading').setAttribute('aria-sort', state.ascending ? 'ascending' : 'descending');
    byId('sort-button').setAttribute('aria-label', state.ascending ? 'Odlot: rosnąco. Kliknij, aby sortować malejąco.' : 'Odlot: malejąco. Kliknij, aby sortować rosnąco.');
    renderFlights();
  });
  refs.tbody.addEventListener('change', (event) => {
    if (event.target.matches('.status-select')) changeStatus(event.target.dataset.flightId, event.target.value, true);
  });
  refs.tbody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-details-id]');
    if (button) openDetails(button.dataset.detailsId);
  });
  byId('details-status').addEventListener('change', (event) => changeStatus(state.detailId, event.target.value));
  byId('theme-button').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
  byId('export-button').addEventListener('click', exportFlights);
  byId('dismiss-toast').addEventListener('click', () => { refs.toast.hidden = true; window.clearTimeout(toastTimer); });

  // Natywne okna dialogowe obsługują klawisz Escape i zatrzymują fokus wewnątrz.
  byId('history-button').addEventListener('click', () => { renderHistory(); openDialog(refs.history); });
  byId('help-button').addEventListener('click', () => openDialog(refs.help));
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
      const opener = dialogOpeners.get(dialog);
      // Zmiana statusu przebudowuje wiersze, więc dawny przycisk może już nie istnieć.
      const target = opener && !opener.isConnected && opener.dataset.detailsId
        ? refs.tbody.querySelector(`[data-details-id="${opener.dataset.detailsId}"]`) || refs.tabs.find((tab) => tab.dataset.filter === state.filter)
        : opener;
      if (target && target.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });

  refs.menu.addEventListener('click', () => sidebarOpen ? closeSidebar() : openSidebar());
  refs.backdrop.addEventListener('click', () => closeSidebar());
  byId('sidebar-close').addEventListener('click', () => closeSidebar());
  refs.sidebar.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', () => closeSidebar()));
  mobileQuery.addEventListener('change', () => closeSidebar(false));
  window.addEventListener('scroll', () => { if (!navigationFrame) navigationFrame = window.requestAnimationFrame(updateNavigation); }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (sidebarOpen) {
      if (event.key === 'Escape') { event.preventDefault(); closeSidebar(); }
      if (event.key === 'Tab') {
        const focusable = [...refs.sidebar.querySelectorAll('a[href], button')].filter((node) => node.getClientRects().length);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (document.querySelector('dialog[open]')) return;
    const isEditing = event.target.matches('input, textarea, select, [contenteditable="true"]');
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditing) {
      event.preventDefault();
      refs.search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === refs.search && state.query) {
      event.preventDefault();
      state.query = '';
      refs.search.value = '';
      renderFlights();
    }
  });

  // Karty tej samej opublikowanej strony mogą odświeżać swój lokalny stan.
  window.addEventListener('storage', (event) => {
    if (event.key === OPERATIONS_KEY || event.key === null) {
      restoreOperations();
      renderSummary();
      renderFlights();
      if (refs.history.open) renderHistory();
      if (refs.details.open) {
        const flight = state.flights.find((item) => item.id === state.detailId);
        if (flight) byId('details-status').value = flight.status;
      }
    }
    if (event.key === THEME_KEY || event.key === null) applyTheme(readStorage(THEME_KEY));
  });

  // Start aplikacji. Wyjątek localStorage nigdy nie zatrzymuje interfejsu.
  restoreOperations();
  applyTheme(readStorage(THEME_KEY));
  renderSummary();
  renderFlights();
  updateClock();
  closeSidebar(false);
  updateNavigation();
  window.setInterval(updateClock, 1000);
  if (corruptSave && !storageFailed) showToast('Nieprawidłowy zapis lokalny. Wczytano bezpieczne dane przykładowe.');
})();
