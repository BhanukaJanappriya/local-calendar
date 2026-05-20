
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toDateInputValue(date) {
  return dateKey(date);
}

export function toDateTimeInputValue(date) {
  const d = new Date(date);
  return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fromDateInputValue(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function fromDateTimeInputValue(value) {
  return new Date(value);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

export function startOfWeek(date) {
  const d = new Date(date);
  const diff = d.getDay();
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(date) {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  d.setMilliseconds(-1);
  return d;
}

export function isSameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

export function formatShortDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatLongDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatTime(date, allDay = false) {
  if (allDay) return 'All day';
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateRange(start, end, allDay = false) {
  const s = new Date(start);
  const e = new Date(end);
  if (allDay) {
    const endMinusOne = new Date(e.getTime() - 24 * 60 * 60 * 1000);
    if (dateKey(s) === dateKey(endMinusOne)) return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${endMinusOne.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }
  if (dateKey(s) === dateKey(e)) {
    return `${formatShortDate(s)} • ${formatTime(s)} – ${formatTime(e)}`;
  }
  return `${formatShortDate(s)} ${formatTime(s)} – ${formatShortDate(e)} ${formatTime(e)}`;
}

export function monthGrid(date) {
  const first = startOfMonth(date);
  const firstDow = first.getDay();
  const gridStart = addDays(first, -firstDow);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    cells.push({
      date: day,
      key: dateKey(day),
      inMonth: day.getMonth() === first.getMonth(),
      today: isSameDay(day, new Date())
    });
  }
  return cells;
}

export function weekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekHourSlots() {
  return Array.from({ length: 24 }, (_, i) => i);
}

export function groupByDate(events) {
  const map = new Map();
  for (const ev of events) {
    const key = dateKey(ev.occurrence_start);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
  }
  return map;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function minutesOfDay(date) {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

export function setTime(date, hour, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function shiftEventOccurrence(ev, newStart) {
  const start = new Date(ev.occurrence_start);
  const end = new Date(ev.occurrence_end);
  const duration = end.getTime() - start.getTime();
  const movedStart = new Date(newStart);
  const movedEnd = new Date(movedStart.getTime() + duration);
  return { start_at: movedStart.toISOString(), end_at: movedEnd.toISOString() };
}

export function occurrenceDisplayRange(ev) {
  return formatDateRange(ev.occurrence_start, ev.occurrence_end, Boolean(ev.all_day));
}

export function buildAgendaSections(events) {
  const sections = new Map();
  for (const ev of events) {
    const key = dateKey(ev.occurrence_start);
    if (!sections.has(key)) sections.set(key, { date: new Date(ev.occurrence_start), items: [] });
    sections.get(key).items.push(ev);
  }
  return [...sections.values()].sort((a, b) => a.date - b.date);
}

export function sameCalendarDay(a, b) {
  return dateKey(a) === dateKey(b);
}
