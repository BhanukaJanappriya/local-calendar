
import { CalendarAPI } from './api.js';
import {
  DOW, DOW_LONG, addDays, addMonths, buildAgendaSections, clamp, dateKey, endOfMonth, endOfWeek,
  formatDateRange, formatLongDate, formatShortDate, formatTime, groupByDate, isSameDay, monthGrid,
  minutesOfDay, occurrenceDisplayRange, setTime, shiftEventOccurrence, startOfMonth, startOfWeek, toDateInputValue,
  toDateTimeInputValue, fromDateInputValue, fromDateTimeInputValue, weekDays, weekHourSlots
} from './utils.js';

const state = {
  view: 'week',
  currentDate: new Date(),
  search: '',
  calendars: [],
  settings: {},
  visibleCalendarIds: new Set(),
  events: [],
  activeEvent: null,
  dragEventId: null,
  rangeStart: null,
  rangeEnd: null,
  calendarLoadTimer: null,
  timePicker: {
    targetInput: null,
    mode: 'hours', // 'hours' or 'minutes'
    selectedHour: 12,
    selectedMinute: 0,
    ampm: 'AM'
  }
};

const el = {};

function cacheDom() {
  el.miniCalendar = document.getElementById('miniCalendar');
  el.calendarList = document.getElementById('calendarList');
  el.calendarRoot = document.getElementById('calendarRoot');
  el.pageTitle = document.getElementById('pageTitle');
  el.pageSubtitle = document.getElementById('pageSubtitle');
  el.searchInput = document.getElementById('searchInput');
  el.jumpDate = document.getElementById('jumpDate');
  el.viewButtons = [...document.querySelectorAll('.tab-btn')];
  el.filterBtn = document.getElementById('filterBtn');
  el.filterDropdown = document.getElementById('filterDropdown');
  el.filterCalendarList = document.getElementById('filterCalendarList');
  el.liveClock = document.getElementById('liveClock');
  el.modalOverlay = document.getElementById('modalOverlay');
  el.eventForm = document.getElementById('eventForm');
  el.modalTitle = document.getElementById('modalTitle');
  el.eventId = document.getElementById('eventId');
  el.titleInput = document.getElementById('titleInput');
  el.calendarSelect = document.getElementById('calendarSelect');
  el.startDateInput = document.getElementById('startDateInput');
  el.endDateInput = document.getElementById('endDateInput');
  el.startTimeInput = document.getElementById('startTimeInput');
  el.endTimeInput = document.getElementById('endTimeInput');
  el.allDayInput = document.getElementById('allDayInput');
  el.notifyInput = document.getElementById('notifyInput');
  el.timeRow = document.getElementById('timeRow');
  el.locationInput = document.getElementById('locationInput');
  el.reminderInput = document.getElementById('reminderInput');
  el.descriptionInput = document.getElementById('descriptionInput');
  el.recurrenceType = document.getElementById('recurrenceType');
  el.recurrenceInterval = document.getElementById('recurrenceInterval');
  el.recurrenceUntil = document.getElementById('recurrenceUntil');
  el.deleteEventBtn = document.getElementById('deleteEventBtn');
  el.closeModalBtn = document.getElementById('closeModalBtn');
  el.cancelBtn = document.getElementById('cancelBtn');
  el.newEventBtn = document.getElementById('newEventBtn');
  el.todayBtn = document.getElementById('todayBtn');
  el.miniTodayBtn = document.getElementById('miniTodayBtn');
  el.prevBtn = document.getElementById('prevBtn');
  el.nextBtn = document.getElementById('nextBtn');
  el.addCalendarBtn = document.getElementById('addCalendarBtn');
  el.addCalendarBtnTop = document.getElementById('addCalendarBtnTop');
  el.weeklyDaysSelector = document.getElementById('weeklyDaysSelector');
  el.dayCircles = [...document.querySelectorAll('.day-circle')];

  // Time Picker Elements
  el.tpOverlay = document.getElementById('timePickerOverlay');
  el.tpSelectedHour = document.getElementById('tpSelectedHour');
  el.tpSelectedMinute = document.getElementById('tpSelectedMinute');
  el.tpAM = document.getElementById('tpAM');
  el.tpPM = document.getElementById('tpPM');
  el.clockFace = document.getElementById('clockFace');
  el.clockHand = document.getElementById('clockHand');
  el.clockNumbers = document.getElementById('clockNumbers');
  el.tpCancel = document.getElementById('tpCancel');
  el.tpOK = document.getElementById('tpOK');
}

function initTimePicker() {
  const openPicker = (e) => {
    e.preventDefault();
    state.timePicker.targetInput = e.target;
    const [h24, m] = (e.target.value || '12:00').split(':').map(Number);
    state.timePicker.selectedHour = h24 % 12 || 12;
    state.timePicker.ampm = h24 >= 12 ? 'PM' : 'AM';
    state.timePicker.selectedMinute = m;
    state.timePicker.mode = 'hours';
    updateTPUI();
    el.tpOverlay.classList.remove('hidden');
  };

  el.startTimeInput.addEventListener('mousedown', openPicker);
  el.endTimeInput.addEventListener('mousedown', openPicker);

  el.tpSelectedHour.addEventListener('click', () => { state.timePicker.mode = 'hours'; updateTPUI(); });
  el.tpSelectedMinute.addEventListener('click', () => { state.timePicker.mode = 'minutes'; updateTPUI(); });
  el.tpAM.addEventListener('click', () => { state.timePicker.ampm = 'AM'; updateTPUI(); });
  el.tpPM.addEventListener('click', () => { state.timePicker.ampm = 'PM'; updateTPUI(); });

  el.clockFace.addEventListener('mousedown', handleClockInteraction);
  el.tpCancel.addEventListener('click', () => el.tpOverlay.classList.add('hidden'));
  el.tpOK.addEventListener('click', () => {
    let h = state.timePicker.selectedHour % 12;
    if (state.timePicker.ampm === 'PM') h += 12;
    const timeStr = `${pad2(h)}:${pad2(state.timePicker.selectedMinute)}`;
    state.timePicker.targetInput.value = timeStr;
    el.tpOverlay.classList.add('hidden');
  });
}

function handleClockInteraction(e) {
  const rect = el.clockFace.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const update = (moveEvent) => {
    const x = moveEvent.clientX - centerX;
    const y = moveEvent.clientY - centerY;
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (state.timePicker.mode === 'hours') {
      let hour = Math.round(angle / 30) || 12;
      if (hour > 12) hour = hour % 12;
      state.timePicker.selectedHour = hour;
    } else {
      let minute = Math.round(angle / 6) * 1;
      if (minute >= 60) minute = 0;
      state.timePicker.selectedMinute = minute;
    }
    updateTPUI();
  };

  update(e);

  const onMouseUp = () => {
    document.removeEventListener('mousemove', update);
    document.removeEventListener('mouseup', onMouseUp);
    if (state.timePicker.mode === 'hours') {
      state.timePicker.mode = 'minutes';
      updateTPUI();
    }
  };
  document.addEventListener('mousemove', update);
  document.addEventListener('mouseup', onMouseUp);
}

function updateTPUI() {
  const { mode, selectedHour, selectedMinute, ampm } = state.timePicker;
  el.tpSelectedHour.textContent = pad2(selectedHour);
  el.tpSelectedMinute.textContent = pad2(selectedMinute);
  el.tpSelectedHour.classList.toggle('active', mode === 'hours');
  el.tpSelectedMinute.classList.toggle('active', mode === 'minutes');
  el.tpAM.classList.toggle('active', ampm === 'AM');
  el.tpPM.classList.toggle('active', ampm === 'PM');

  const angle = mode === 'hours' ? (selectedHour % 12) * 30 : selectedMinute * 6;
  el.clockHand.style.transform = `rotate(${angle}deg)`;

  // Render numbers
  el.clockNumbers.innerHTML = '';
  const radius = 80;

  for (let i = 1; i <= 12; i++) {
    // For hours: 1, 2, 3... 12
    // For minutes: 5, 10, 15... 00 (where 12 is 00)
    const hourVal = i;
    const minuteVal = (i * 5) % 60;
    const displayVal = mode === 'hours' ? hourVal : pad2(minuteVal);
    
    const numAngle = (i * 30) - 90;
    const x = Math.cos(numAngle * Math.PI / 180) * radius + 100;
    const y = Math.sin(numAngle * Math.PI / 180) * radius + 100;
    
    const div = document.createElement('div');
    div.className = 'clock-number';
    
    const isActive = mode === 'hours' 
      ? (hourVal === selectedHour)
      : (minuteVal === selectedMinute);

    if (isActive) {
      div.classList.add('active');
    }
    
    div.style.left = `${x - 16}px`;
    div.style.top = `${y - 16}px`;
    div.textContent = displayVal;
    el.clockNumbers.appendChild(div);
  }
}

function setAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color || '#0f9d58');
}

function saveSetting(key, value) {
  return CalendarAPI.setSetting({ key, value });
}

function persistViewState() {
  saveSetting('defaultView', state.view);
  saveSetting('lastDate', dateKey(state.currentDate));
  saveSetting('calendarSearch', state.search);
}

function parseSavedDate(value) {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function visibleCalendarIds() {
  return [...state.visibleCalendarIds];
}

function rangeForView() {
  if (state.view === 'month') {
    const s = startOfMonth(state.currentDate);
    s.setDate(s.getDate() - s.getDay());
    const e = new Date(s);
    e.setDate(e.getDate() + 41);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  if (state.view === 'week') {
    const s = startOfWeek(state.currentDate);
    const e = endOfWeek(state.currentDate);
    return { start: s, end: e };
  }
  if (state.view === 'day') {
    const s = new Date(state.currentDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  const s = startOfMonth(state.currentDate);
  const e = new Date(s);
  e.setMonth(e.getMonth() + 2);
  e.setDate(0);
  e.setHours(23, 59, 59, 999);
  return { start: s, end: e };
}

async function loadBootstrap() {
  const bootstrap = await CalendarAPI.bootstrap();
  state.calendars = bootstrap.calendars || [];
  state.settings = bootstrap.settings || {};

  setAccentColor(state.settings.accentColor || '#0f9d58');

  const savedView = state.settings.defaultView || 'week';
  const savedDate = parseSavedDate(state.settings.lastDate);
  const savedSearch = state.settings.calendarSearch || '';

  state.view = savedView;
  state.currentDate = savedDate;
  state.search = savedSearch;

  el.searchInput.value = state.search;
  el.jumpDate.value = toDateInputValue(state.currentDate);
  el.viewButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === state.view));
  state.visibleCalendarIds = new Set(state.calendars.filter((c) => c.visible !== 0).map((c) => c.id));

  await reloadEvents();
}

async function reloadEvents() {
  const { start, end } = rangeForView();
  state.rangeStart = start;
  state.rangeEnd = end;
  state.events = await CalendarAPI.listEvents({
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    calendarIds: visibleCalendarIds(),
    search: state.search
  });
  renderAll();
}

function eventStart(ev) {
  return new Date(ev.occurrence_start);
}

function eventEnd(ev) {
  return new Date(ev.occurrence_end);
}

function renderAll() {
  renderSidebar();
  renderTitle();
  renderCalendar();
}

function renderTitle() {
  if (state.view === 'month') {
    el.pageTitle.textContent = state.currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
    el.pageSubtitle.textContent = `${state.events.length} event occurrence${state.events.length === 1 ? '' : 's'} visible`;
  } else if (state.view === 'week') {
    const s = startOfWeek(state.currentDate);
    const e = endOfWeek(state.currentDate);
    el.pageTitle.textContent = 'Week view';
    el.pageSubtitle.textContent = `${formatShortDate(s)} – ${formatShortDate(e)}`;
  } else if (state.view === 'day') {
    el.pageTitle.textContent = formatLongDate(state.currentDate);
    el.pageSubtitle.textContent = 'Day view';
  } else {
    el.pageTitle.textContent = 'Agenda';
    el.pageSubtitle.textContent = `${formatShortDate(state.rangeStart)} – ${formatShortDate(state.rangeEnd)}`;
  }
}

function renderSidebar() {
  renderMiniCalendar();
  renderCalendarList();
}

function renderMiniCalendar() {
  const grid = monthGrid(state.currentDate);
  const monthLabel = state.currentDate.toLocaleDateString([], { month: 'short', year: 'numeric' });
  const header = DOW.map((d) => `<div class="mini-head">${d[0]}</div>`).join('');
  const cells = grid.map(({ date, inMonth, today }) => {
    const active = isSameDay(date, state.currentDate);
    const cls = ['mini-day'];
    if (!inMonth) cls.push('other');
    if (today) cls.push('today');
    if (active) cls.push('active');
    return `<button class="${cls.join(' ')}" data-mini-date="${toDateInputValue(date)}">${date.getDate()}</button>`;
  }).join('');
  el.miniCalendar.innerHTML = `
    <div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong>${monthLabel}</strong>
      <span class="muted" style="font-size:12px;">${formatLongDate(new Date())}</span>
    </div>
    ${header}
    ${cells}
  `;

  el.miniCalendar.querySelectorAll('[data-mini-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentDate = new Date(`${btn.dataset.miniDate}T12:00`);
      el.jumpDate.value = btn.dataset.miniDate;
      persistViewState();
      reloadEvents();
    });
  });
}

function renderCalendarList() {
  if (!state.calendars.length) {
    el.calendarList.innerHTML = '<div class="muted">No calendars found.</div>';
    el.filterCalendarList.innerHTML = '<div class="muted">No calendars found.</div>';
    return;
  }
  
  // Render sidebar list
  el.calendarList.innerHTML = state.calendars.map((cal) => {
    const checked = state.visibleCalendarIds.has(cal.id);
    return `
      <div class="calendar-item">
        <label>
          <input type="checkbox" data-cal-toggle="${cal.id}" ${checked ? 'checked' : ''} />
          <span class="calendar-dot" style="background:${cal.color}"></span>
          <span>${cal.name}</span>
        </label>
        <div class="calendar-actions">
          <button class="icon-btn" data-edit-cal="${cal.id}" title="Edit calendar">✎</button>
        </div>
      </div>
    `;
  }).join('');

  // Render filter dropdown list
  el.filterCalendarList.innerHTML = state.calendars.map((cal) => {
    const checked = state.visibleCalendarIds.has(cal.id);
    return `
      <div class="filter-calendar-item" data-cal-id="${cal.id}">
        <input type="checkbox" data-cal-toggle="${cal.id}" ${checked ? 'checked' : ''} />
        <span class="color-dot" style="background:${cal.color}"></span>
        <span>${cal.name}</span>
      </div>
    `;
  }).join('');

  const attachToggles = (selector) => {
    document.querySelectorAll(selector).forEach((chk) => {
      chk.addEventListener('change', async (e) => {
        const id = Number(e.target.dataset.calToggle);
        const visible = e.target.checked;
        await CalendarAPI.toggleCalendar({ id, visible });
        if (visible) state.visibleCalendarIds.add(id);
        else state.visibleCalendarIds.delete(id);
        
        // Sync both lists
        document.querySelectorAll(`[data-cal-toggle="${id}"]`).forEach(input => input.checked = visible);
        
        reloadEvents();
      });
    });
  };

  attachToggles('[data-cal-toggle]');

  el.calendarList.querySelectorAll('[data-edit-cal]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.editCal);
      const cal = state.calendars.find((c) => c.id === id);
      const name = prompt('Calendar name', cal?.name || '');
      if (!name) return;
      const color = prompt('Calendar color (hex)', cal?.color || '#0f9d58') || cal?.color || '#0f9d58';
      await CalendarAPI.saveCalendar({ id, name: name.trim(), color, visible: cal?.visible !== 0 });
      await refreshCalendars();
    });
  });
}

async function refreshCalendars() {
  state.calendars = await CalendarAPI.listCalendars();
  state.visibleCalendarIds = new Set(state.calendars.filter((c) => c.visible !== 0).map((c) => c.id));
  renderSidebar();
  await reloadEvents();
}

function renderCalendar() {
  const view = state.view;
  if (view === 'month') {
    renderMonthView();
  } else if (view === 'week') {
    renderWeekView(7);
  } else if (view === 'day') {
    renderWeekView(1);
  } else {
    renderAgendaView();
  }
}

function eventPillHtml(ev) {
  const color = ev.calendar_color;
  const start = new Date(ev.occurrence_start);
  const end = new Date(ev.occurrence_end);
  const timeLabel = ev.all_day ? 'All day' : `${formatTime(start)} – ${formatTime(end)}`;
  return `
    <div class="event-chip ${ev.all_day ? 'all-day' : ''}" draggable="true" data-event-id="${ev.id}" data-occurrence-start="${ev.occurrence_start}" style="border-left-color:${color}">
      <strong>${ev.title}</strong>
      <span>${timeLabel}</span>
    </div>
  `;
}

function renderMonthView() {
  const grid = monthGrid(state.currentDate);
  const groups = groupByDate(state.events);
  const html = `
    <div class="calendar-card month-grid">
      ${DOW.map((d) => `<div class="month-head">${d}</div>`).join('')}
      ${grid.map(({ date, inMonth, today, key }) => {
        const dayEvents = groups.get(key) || [];
        const badges = dayEvents.slice(0, 4).map((ev) => `
          <div class="event-chip ${ev.all_day ? 'all-day' : ''}" draggable="true" data-event-id="${ev.id}" data-occurrence-start="${ev.occurrence_start}" style="border-left-color:${ev.calendar_color}">
            <strong>${ev.title}</strong>
          </div>
        `).join('');
        const extra = dayEvents.length > 4 ? `<div class="badge">+${dayEvents.length - 4} more</div>` : '';
        return `
          <div class="month-day ${inMonth ? '' : 'other-month'} ${today ? 'today' : ''}" data-day="${key}">
            <div class="day-number">
              <span>${date.getDate()}</span>
              ${extra}
            </div>
            <div class="day-events">${badges}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  el.calendarRoot.innerHTML = html;
  attachEventCardHandlers();
  attachMonthDropHandlers();
  attachMonthCellClickHandlers();
}

function renderWeekView(dayCount) {
  const days = weekDays(state.currentDate).slice(0, dayCount);
  const itemsByDay = new Map(days.map((d) => [dateKey(d), []]));
  const allDayByDay = new Map(days.map((d) => [dateKey(d), []]));
  for (const ev of state.events) {
    const key = dateKey(ev.occurrence_start);
    if (!itemsByDay.has(key)) continue;
    if (ev.all_day) allDayByDay.get(key).push(ev);
    else itemsByDay.get(key).push(ev);
  }

  for (const [_, list] of itemsByDay) {
    list.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
  }

  const head = `
    <div class="week-head" style="grid-template-columns:76px repeat(${dayCount},1fr)">
      <div class="corner"></div>
      ${days.map((d) => `
        <div class="week-day-head ${isSameDay(d, new Date()) ? 'today' : ''}">
          <div class="dow">${DOW_LONG[d.getDay()]}</div>
          <div class="dom">${d.getDate()}</div>
        </div>
      `).join('')}
    </div>
  `;

  const allDayRow = `
    <div class="all-day-row" style="grid-template-columns:76px repeat(${dayCount},1fr)">
      <div class="label">All-day</div>
      ${days.map((d) => {
        const key = dateKey(d);
        const list = allDayByDay.get(key) || [];
        return `
          <div class="all-day-cell" data-date="${key}" data-all-day-cell="1">
            ${list.map(ev => `
              <div class="all-day-item" draggable="true" data-event-id="${ev.id}" data-occurrence-start="${ev.occurrence_start}" style="border-left-color:${ev.calendar_color}">
                ${ev.title}
                <small>${ev.calendar_name}</small>
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;

  const hours = weekHourSlots();
  const body = `
    <div class="week-body" style="grid-template-columns:76px repeat(${dayCount},1fr)">
      <div class="time-col">
        ${hours.map((h) => `<div class="time-slot-label">${h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}</div>`).join('')}
      </div>
      ${days.map((d) => renderDayColumn(d, itemsByDay.get(dateKey(d)) || [] , dayCount)).join('')}
    </div>
  `;

  el.calendarRoot.innerHTML = `<div class="week-wrap"><div class="week-scroll">${head}${allDayRow}${body}</div></div>`;
  attachEventCardHandlers();
  attachWeekDropHandlers();
  attachWeekCellClickHandlers(days);
}

function renderDayColumn(day, events, dayCount) {
  const dayMinutesHeight = 24 * 60;
  const lanes = assignLanes(events.filter((ev) => !ev.all_day));
  const blocks = lanes.map(({ ev, lane, totalLanes }) => {
    const start = new Date(ev.occurrence_start);
    const end = new Date(ev.occurrence_end);
    const top = (start.getHours() * 60 + start.getMinutes());
    const height = Math.max(32, ((end.getTime() - start.getTime()) / 60000));
    const widthPercent = 100 / totalLanes;
    const leftPercent = lane * widthPercent;
    return `
      <div class="timeline-event" draggable="true" data-event-id="${ev.id}" data-occurrence-start="${ev.occurrence_start}"
        style="top:${top}px;height:${height}px;left:calc(${leftPercent}% + 4px);width:calc(${widthPercent}% - 8px);border-left-color:${ev.calendar_color}">
        <div class="time">${formatTime(start)} ${ev.all_day ? '' : '– ' + formatTime(end)}</div>
        <div class="title">${ev.title}</div>
        <div class="meta">${ev.calendar_name}${ev.location ? ' • ' + ev.location : ''}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="day-column" data-date="${dateKey(day)}">
      ${weekHourSlots().map((hour) => `<div class="hour-slot" data-date="${dateKey(day)}" data-hour="${hour}"></div>`).join('')}
      ${blocks}
    </div>
  `;
}

function assignLanes(events) {
  const sorted = [...events].sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
  const active = [];
  const result = [];

  for (const ev of sorted) {
    const start = new Date(ev.occurrence_start).getTime();
    const end = new Date(ev.occurrence_end).getTime();
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= start) active.splice(i, 1);
    }
    const used = new Set(active.map((a) => a.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    active.push({ lane, end });
    const totalLanes = Math.max(active.length, used.size + 1);
    result.push({ ev, lane, totalLanes });
  }
  return result;
}

function renderAgendaView() {
  const sections = buildAgendaSections(state.events);
  if (!sections.length) {
    el.calendarRoot.innerHTML = `
      <div class="agenda">
        <div class="empty-state">
          <div class="card">
            <h2>No events found</h2>
            <p>Try another date, or create a new event for this local calendar.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const html = sections.map((section) => `
    <div class="agenda-day">
      <h3 class="agenda-date">${formatLongDate(section.date)}</h3>
      ${section.items.map((ev) => `
        <div class="agenda-item">
          <div class="agenda-time">${occurrenceDisplayRange(ev)}</div>
          <div class="agenda-main">
            <div class="agenda-title"><span class="dot" style="background:${ev.calendar_color};margin-right:8px"></span>${ev.title}</div>
            <div class="agenda-desc">${ev.calendar_name}${ev.location ? ' • ' + ev.location : ''}${ev.description ? ' • ' + ev.description : ''}</div>
          </div>
          <button class="icon-btn" data-open-event="${ev.id}">↗</button>
        </div>
      `).join('')}
    </div>
  `).join('');

  el.calendarRoot.innerHTML = `<div class="agenda">${html}</div>`;
  attachAgendaHandlers();
}

function attachAgendaHandlers() {
  el.calendarRoot.querySelectorAll('[data-open-event]').forEach((btn) => {
    btn.addEventListener('click', () => openEventById(Number(btn.dataset.openEvent)));
  });
}

function attachEventCardHandlers() {
  document.querySelectorAll('[data-event-id]').forEach((node) => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      openEventById(Number(node.dataset.eventId));
    });
    node.addEventListener('dragstart', (e) => {
      state.dragEventId = Number(node.dataset.eventId);
      e.dataTransfer.setData('text/plain', String(state.dragEventId));
      e.dataTransfer.effectAllowed = 'move';
      node.classList.add('dragging');
    });
    node.addEventListener('dragend', () => {
      state.dragEventId = null;
      node.classList.remove('dragging');
      document.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
    });
  });
}

function attachMonthCellClickHandlers() {
  document.querySelectorAll('.month-day').forEach((cell) => {
    cell.addEventListener('click', async () => {
      const date = cell.dataset.day;
      openNewEvent(date);
    });
  });
}

function attachMonthDropHandlers() {
  document.querySelectorAll('.month-day').forEach((cell) => {
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      cell.classList.add('drop-target');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
    cell.addEventListener('drop', async (e) => {
      e.preventDefault();
      cell.classList.remove('drop-target');
      const id = Number(e.dataTransfer.getData('text/plain') || state.dragEventId);
      if (!id) return;
      const ev = state.events.find((item) => item.id === id);
      if (!ev) return;
      const targetDate = cell.dataset.day;
      await moveOccurrenceToDate(ev, targetDate);
    });
  });
}

function attachWeekDropHandlers() {
  document.querySelectorAll('.hour-slot').forEach((slot) => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drop-target');
      slot.parentElement.classList.add('drop-target');
    });
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drop-target');
      slot.parentElement.classList.remove('drop-target');
    });
    slot.addEventListener('drop', async (e) => {
      e.preventDefault();
      slot.classList.remove('drop-target');
      slot.parentElement.classList.remove('drop-target');
      const id = Number(e.dataTransfer.getData('text/plain') || state.dragEventId);
      if (!id) return;
      const ev = state.events.find((item) => item.id === id);
      if (!ev) return;
      const dateStr = slot.dataset.date;
      const hour = Number(slot.dataset.hour);
      await moveOccurrenceToDate(ev, dateStr, hour);
    });
  });

  document.querySelectorAll('.all-day-cell').forEach((cell) => {
    cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drop-target'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
    cell.addEventListener('drop', async (e) => {
      e.preventDefault();
      cell.classList.remove('drop-target');
      const id = Number(e.dataTransfer.getData('text/plain') || state.dragEventId);
      if (!id) return;
      const ev = state.events.find((item) => item.id === id);
      if (!ev) return;
      await moveOccurrenceToDate(ev, cell.dataset.date, null, true);
    });
  });
}

function attachWeekCellClickHandlers(days) {
  document.querySelectorAll('.day-column').forEach((col) => {
    col.addEventListener('dblclick', () => {
      openNewEvent(col.dataset.date);
    });
  });
}

async function moveOccurrenceToDate(ev, dateStr, hour = null, allDay = false) {
  const start = new Date(ev.occurrence_start);
  const end = new Date(ev.occurrence_end);
  const durationMs = end.getTime() - start.getTime();
  let newStart;
  if (allDay) {
    newStart = new Date(`${dateStr}T00:00`);
    const newEnd = new Date(newStart);
    const days = Math.max(1, Math.round(durationMs / (24 * 60 * 60 * 1000)));
    newEnd.setDate(newEnd.getDate() + days);
    await CalendarAPI.moveEvent({
      id: ev.id,
      data: {
        start_at: toDateTimeInputValue(newStart),
        end_at: toDateTimeInputValue(newEnd),
        all_day: 1
      }
    });
  } else {
    newStart = new Date(`${dateStr}T${String(hour ?? start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
    const newEnd = new Date(newStart.getTime() + durationMs);
    await CalendarAPI.moveEvent({
      id: ev.id,
      data: {
        start_at: toDateTimeInputValue(newStart),
        end_at: toDateTimeInputValue(newEnd),
        all_day: ev.all_day ? 1 : 0
      }
    });
  }
  await reloadEvents();
}

function fillCalendarSelect() {
  el.calendarSelect.innerHTML = state.calendars.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
}

function openModal() {
  el.modalOverlay.classList.remove('hidden');
}

function initWeeklyDaySelector() {
  el.dayCircles.forEach(circle => {
    circle.addEventListener('click', () => {
      circle.classList.toggle('active');
    });
  });
}

function getSelectedWeeklyDays() {
  return el.dayCircles
    .filter(c => c.classList.contains('active'))
    .map(c => Number(c.dataset.day));
}

function setSelectedWeeklyDays(days = []) {
  el.dayCircles.forEach(c => {
    c.classList.toggle('active', days.includes(Number(c.dataset.day)));
  });
}

function toggleRecurrenceUI() {
  const isWeekly = el.recurrenceType.value === 'weekly';
  el.weeklyDaysSelector.classList.toggle('hidden', !isWeekly);
}

function toggleTimeInputs() {
  el.timeRow.style.display = el.allDayInput.checked ? 'none' : 'flex';
}

function closeModal() {
  el.modalOverlay.classList.add('hidden');
  el.eventForm.reset();
  el.eventId.value = '';
  el.deleteEventBtn.classList.add('hidden');
  setSelectedWeeklyDays([]);
  toggleRecurrenceUI();
}

function openNewEvent(dateStr = null) {
  const date = dateStr || toDateInputValue(state.currentDate);
  fillCalendarSelect();
  el.eventForm.reset();
  el.eventId.value = '';
  el.titleInput.value = '';
  el.calendarSelect.value = state.calendars[0]?.id || '';
  el.startDateInput.value = date;
  el.endDateInput.value = date;
  el.startTimeInput.value = '09:00';
  el.endTimeInput.value = '10:00';
  el.allDayInput.checked = false;
  el.notifyInput.checked = true;
  el.timeRow.style.display = 'flex';
  el.locationInput.value = '';
  el.descriptionInput.value = '';
  el.reminderInput.value = '10';
  el.recurrenceType.value = 'none';
  el.recurrenceInterval.value = '1';
  el.recurrenceUntil.value = '';
  el.deleteEventBtn.classList.add('hidden');
  setSelectedWeeklyDays([]);
  toggleRecurrenceUI();
  openModal();
}

async function openEventById(id) {
  const ev = await CalendarAPI.getEvent(id);
  if (!ev) return;
  fillCalendarSelect();
  el.eventId.value = ev.id;
  el.titleInput.value = ev.title;
  el.calendarSelect.value = ev.calendar_id;
  el.allDayInput.checked = Boolean(ev.all_day);
  el.notifyInput.checked = Number(ev.reminder_minutes) > 0;
  el.locationInput.value = ev.location || '';
  el.descriptionInput.value = ev.description || '';
  el.reminderInput.value = ev.reminder_minutes ?? 10;
  el.recurrenceType.value = ev.recurrence_type || 'none';
  el.recurrenceInterval.value = ev.recurrence_interval || 1;
  el.recurrenceUntil.value = ev.recurrence_until ? toDateInputValue(ev.recurrence_until) : '';

  setSelectedWeeklyDays([]); 
  toggleRecurrenceUI();

  const s = new Date(ev.start_at);
  const e = new Date(ev.end_at);
  el.startDateInput.value = toDateInputValue(s);
  el.endDateInput.value = toDateInputValue(ev.all_day ? new Date(e.getTime() - 24 * 60 * 60 * 1000) : e);
  el.startTimeInput.value = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
  const endTimeSource = ev.all_day ? new Date(e.getTime() - 24 * 60 * 60 * 1000) : e;
  el.endTimeInput.value = `${String(endTimeSource.getHours()).padStart(2, '0')}:${String(endTimeSource.getMinutes()).padStart(2, '0')}`;
  el.timeRow.style.display = ev.all_day ? 'none' : 'flex';
  el.deleteEventBtn.classList.remove('hidden');
  openModal();
}

function collectEventPayload() {
  const isAllDay = el.allDayInput.checked;
  const startDate = fromDateInputValue(el.startDateInput.value);
  const endDate = fromDateInputValue(el.endDateInput.value || el.startDateInput.value);

  let startAt;
  let endAt;

  if (isAllDay) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    startAt = toDateTimeInputValue(start);
    endAt = toDateTimeInputValue(end);
  } else {
    const [sh, sm] = (el.startTimeInput.value || '09:00').split(':').map(Number);
    const [eh, em] = (el.endTimeInput.value || '10:00').split(':').map(Number);
    const start = setTime(startDate, sh, sm);
    let end = setTime(endDate, eh, em);
    if (end <= start) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    startAt = toDateTimeInputValue(start);
    endAt = toDateTimeInputValue(end);
  }

  const recurrenceType = el.recurrenceType.value;
  const recurrenceInterval = Math.max(1, Number(el.recurrenceInterval.value || 1));
  const recurrenceUntil = el.recurrenceUntil.value ? `${el.recurrenceUntil.value}T23:59` : null;

  let description = el.descriptionInput.value.trim();
  if (recurrenceType === 'weekly') {
    const days = getSelectedWeeklyDays();
    if (days.length) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const selectedNames = days.map(d => dayNames[d]).join(', ');
      description = `[Repeats on: ${selectedNames}]\n${description}`;
    }
  }

  return {
    calendar_id: Number(el.calendarSelect.value),
    title: el.titleInput.value.trim(),
    description: description,
    location: el.locationInput.value.trim(),
    start_at: startAt,
    end_at: endAt,
    all_day: isAllDay ? 1 : 0,
    recurrence_type: recurrenceType,
    recurrence_interval: recurrenceInterval,
    recurrence_until: recurrenceUntil,
    recurrence_count: null,
    reminder_minutes: el.notifyInput.checked ? Number(el.reminderInput.value || 10) : 0
  };
}

async function submitEvent(e) {
  e.preventDefault();
  const payload = collectEventPayload();
  if (!payload.title) return;
  const id = el.eventId.value ? Number(el.eventId.value) : null;
  if (id) {
    await CalendarAPI.updateEvent({ id, data: payload });
  } else {
    await CalendarAPI.createEvent(payload);
  }
  closeModal();
  await reloadEvents();
}

async function deleteEvent() {
  const id = Number(el.eventId.value);
  if (!id) return;
  if (!confirm('Delete this event?')) return;
  await CalendarAPI.deleteEvent(id);
  closeModal();
  await reloadEvents();
}

async function createCalendarQuickly() {
  const name = prompt('Calendar name', 'New calendar');
  if (!name) return;
  const color = prompt('Calendar color (hex)', '#0f9d58') || '#0f9d58';
  await CalendarAPI.saveCalendar({ name: name.trim(), color, visible: 1 });
  await refreshCalendars();
}

function switchView(view) {
  state.view = view;
  el.viewButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  persistViewState();
  reloadEvents();
}

function navigate(direction) {
  if (state.view === 'month') {
    state.currentDate = addMonths(state.currentDate, direction);
  } else if (state.view === 'week') {
    state.currentDate = addDays(state.currentDate, 7 * direction);
  } else if (state.view === 'day') {
    state.currentDate = addDays(state.currentDate, direction);
  } else {
    state.currentDate = addMonths(state.currentDate, direction);
  }
  el.jumpDate.value = toDateInputValue(state.currentDate);
  persistViewState();
  reloadEvents();
}

function goToday() {
  state.currentDate = new Date();
  el.jumpDate.value = toDateInputValue(state.currentDate);
  persistViewState();
  reloadEvents();
}

function attachGlobalEvents() {
  el.newEventBtn.addEventListener('click', () => openNewEvent());
  el.todayBtn.addEventListener('click', goToday);
  el.miniTodayBtn.addEventListener('click', goToday);
  el.prevBtn.addEventListener('click', () => navigate(-1));
  el.nextBtn.addEventListener('click', () => navigate(1));
  el.closeModalBtn.addEventListener('click', closeModal);
  el.cancelBtn.addEventListener('click', closeModal);
  el.allDayInput.addEventListener('change', toggleTimeInputs);
  el.eventForm.addEventListener('submit', submitEvent);
  el.deleteEventBtn.addEventListener('click', deleteEvent);
  el.addCalendarBtn.addEventListener('click', createCalendarQuickly);
  if (el.addCalendarBtnTop) el.addCalendarBtnTop.addEventListener('click', createCalendarQuickly);

  el.filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    el.filterDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (el.filterDropdown && !el.filterDropdown.contains(e.target) && e.target !== el.filterBtn) {
      el.filterDropdown.classList.add('hidden');
    }
  });

  el.viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  let searchTimer = null;
  el.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    state.search = e.target.value;
    searchTimer = setTimeout(() => {
      persistViewState();
      reloadEvents();
    }, 250);
  });

  el.jumpDate.addEventListener('change', (e) => {
    if (!e.target.value) return;
    state.currentDate = new Date(`${e.target.value}T12:00`);
    persistViewState();
    reloadEvents();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openNewEvent();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      el.searchInput.focus();
    }
  });

  CalendarAPI.onToday(() => goToday());
  CalendarAPI.onFocusEvent(({ id }) => {
    CalendarAPI.focusApp();
    openEventById(Number(id));
  });
}

async function init() {
  cacheDom();
  attachGlobalEvents();
  initTimePicker();
  await loadBootstrap();
  fillCalendarSelect();
  if (!el.searchInput.value) el.searchInput.placeholder = 'Search events';
}

init().catch((error) => {
  console.error(error);
  el.calendarRoot.innerHTML = `
    <div class="empty-state">
      <div class="card">
        <h2>Something went wrong</h2>
        <p>${String(error?.message || error)}</p>
      </div>
    </div>
  `;
});
