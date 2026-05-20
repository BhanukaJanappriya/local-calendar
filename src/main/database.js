
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toLocalInputDateTime(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function normalizeDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return toLocalInputDateTime(value);
  if (typeof value === 'string') return value.replace(' ', 'T').slice(0, 16);
  return null;
}

function parseDateTime(value) {
  return value ? new Date(value) : null;
}

function startOfMinute(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonthsClamped(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  const target = new Date(d);
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  target.setHours(d.getHours(), d.getMinutes(), 0, 0);
  return target;
}

function addYearsClamped(date, years) {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear() + years;
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(
    year,
    month,
    Math.min(day, last),
    d.getHours(),
    d.getMinutes(),
    0,
    0
  );
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

class CalendarDB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
    this.seedIfEmpty();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calendars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calendar_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        location TEXT DEFAULT '',
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        all_day INTEGER NOT NULL DEFAULT 0,
        recurrence_type TEXT NOT NULL DEFAULT 'none',
        recurrence_interval INTEGER NOT NULL DEFAULT 1,
        recurrence_until TEXT DEFAULT NULL,
        recurrence_count INTEGER DEFAULT NULL,
        reminder_minutes INTEGER NOT NULL DEFAULT 10,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        occurrence_start TEXT NOT NULL,
        notified_at TEXT NOT NULL,
        UNIQUE(event_id, occurrence_start),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      );
    `);
  }

  seedIfEmpty() {
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM calendars').get().n;
    if (count > 0) return;

    const insertCal = this.db.prepare('INSERT INTO calendars (name, color, visible) VALUES (?, ?, ?)');
    const work = insertCal.run('Work', '#0f9d58', 1).lastInsertRowid;
    const personal = insertCal.run('Personal', '#1a73e8', 1).lastInsertRowid;
    const health = insertCal.run('Health', '#d93025', 1).lastInsertRowid;
    const study = insertCal.run('Study', '#f9ab00', 1).lastInsertRowid;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dt = (days, hour, minute = 0) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      d.setHours(hour, minute, 0, 0);
      return toLocalInputDateTime(d);
    };

    const allDay = (days) => {
      const start = new Date(today);
      start.setDate(start.getDate() + days);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start: toLocalInputDateTime(start), end: toLocalInputDateTime(end) };
    };

    const insertEvent = this.db.prepare(`
      INSERT INTO events
      (calendar_id, title, description, location, start_at, end_at, all_day, recurrence_type, recurrence_interval, recurrence_until, recurrence_count, reminder_minutes)
      VALUES (@calendar_id, @title, @description, @location, @start_at, @end_at, @all_day, @recurrence_type, @recurrence_interval, @recurrence_until, @recurrence_count, @reminder_minutes)
    `);

    insertEvent.run({
      calendar_id: work,
      title: 'Weekly Planning',
      description: 'Review priorities and prepare the week.',
      location: 'Workspace',
      start_at: dt(0, 9, 0),
      end_at: dt(0, 10, 0),
      all_day: 0,
      recurrence_type: 'weekly',
      recurrence_interval: 1,
      recurrence_until: null,
      recurrence_count: null,
      reminder_minutes: 30
    });

    const p1 = allDay(1);
    insertEvent.run({
      calendar_id: personal,
      title: 'Family Dinner',
      description: 'Dinner with family.',
      location: 'Home',
      start_at: p1.start,
      end_at: p1.end,
      all_day: 1,
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_until: null,
      recurrence_count: null,
      reminder_minutes: 120
    });

    insertEvent.run({
      calendar_id: health,
      title: 'Gym Session',
      description: 'Workout and stretching.',
      location: 'Fitness Center',
      start_at: dt(2, 18, 0),
      end_at: dt(2, 19, 15),
      all_day: 0,
      recurrence_type: 'daily',
      recurrence_interval: 2,
      recurrence_until: null,
      recurrence_count: null,
      reminder_minutes: 20
    });

    insertEvent.run({
      calendar_id: study,
      title: 'Research Notes',
      description: 'Work on calendar app prototype.',
      location: 'Desk',
      start_at: dt(0, 14, 0),
      end_at: dt(0, 16, 0),
      all_day: 0,
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_until: null,
      recurrence_count: null,
      reminder_minutes: 15
    });

    this.setSetting('accentColor', '#0f9d58');
    this.setSetting('defaultView', 'week');
    this.setSetting('theme', 'light');
  }

  getCalendars() {
    return this.db.prepare('SELECT * FROM calendars ORDER BY id').all();
  }

  updateCalendarVisibility(id, visible) {
    this.db.prepare('UPDATE calendars SET visible = ? WHERE id = ?').run(visible ? 1 : 0, id);
    return this.getCalendars();
  }

  upsertCalendar(calendar) {
    if (calendar.id) {
      this.db.prepare('UPDATE calendars SET name = ?, color = ?, visible = ? WHERE id = ?')
        .run(calendar.name, calendar.color, calendar.visible ? 1 : 0, calendar.id);
      return calendar.id;
    }
    return this.db.prepare('INSERT INTO calendars (name, color, visible) VALUES (?, ?, ?)')
      .run(calendar.name, calendar.color, calendar.visible ? 1 : 0).lastInsertRowid;
  }

  deleteCalendar(id) {
    this.db.prepare('DELETE FROM calendars WHERE id = ?').run(id);
  }

  getEventById(id) {
    return this.db.prepare(`
      SELECT e.*, c.name AS calendar_name, c.color AS calendar_color, c.visible AS calendar_visible
      FROM events e
      JOIN calendars c ON c.id = e.calendar_id
      WHERE e.id = ?
    `).get(id) || null;
  }

  listEventsRaw({ calendarIds = [], search = '' } = {}) {
    const where = [];
    const params = [];
    if (calendarIds && calendarIds.length) {
      where.push(`e.calendar_id IN (${calendarIds.map(() => '?').join(',')})`);
      params.push(...calendarIds);
    }
    if (search && search.trim()) {
      where.push(`(
        LOWER(e.title) LIKE ? OR
        LOWER(e.description) LIKE ? OR
        LOWER(e.location) LIKE ?
      )`);
      const q = `%${search.trim().toLowerCase()}%`;
      params.push(q, q, q);
    }
    const sql = `
      SELECT e.*, c.name AS calendar_name, c.color AS calendar_color, c.visible AS calendar_visible
      FROM events e
      JOIN calendars c ON c.id = e.calendar_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.start_at ASC, e.id ASC
    `;
    return this.db.prepare(sql).all(...params);
  }

  _expandEvent(event, rangeStart, rangeEnd) {
    const occurrences = [];
    const start = parseDateTime(event.start_at);
    const end = parseDateTime(event.end_at);
    if (!start || !end) return occurrences;

    const durationMs = Math.max(15 * 60 * 1000, end.getTime() - start.getTime());
    const recurrenceType = (event.recurrence_type || 'none').toLowerCase();
    if (recurrenceType === 'none') {
      if (overlaps(start, end, rangeStart, rangeEnd)) {
        occurrences.push({
          ...event,
          occurrence_start: start.toISOString(),
          occurrence_end: end.toISOString(),
          is_recurring: false
        });
      }
      return occurrences;
    }

    const interval = Math.max(1, Number(event.recurrence_interval || 1));
    const until = event.recurrence_until ? parseDateTime(event.recurrence_until) : null;
    const maxCount = event.recurrence_count ? Number(event.recurrence_count) : Infinity;

    let current = new Date(start);
    let generated = 0;

    while (generated < maxCount && current <= rangeEnd) {
      const currentEnd = new Date(current.getTime() + durationMs);

      if ((!until || current <= until) && overlaps(current, currentEnd, rangeStart, rangeEnd)) {
        occurrences.push({
          ...event,
          occurrence_start: current.toISOString(),
          occurrence_end: currentEnd.toISOString(),
          is_recurring: true
        });
      }

      generated += 1;
      if (recurrenceType === 'daily') {
        current = addDays(current, interval);
      } else if (recurrenceType === 'weekly') {
        current = addDays(current, interval * 7);
      } else if (recurrenceType === 'monthly') {
        current = addMonthsClamped(current, interval);
      } else if (recurrenceType === 'yearly') {
        current = addYearsClamped(current, interval);
      } else {
        break;
      }
      current = startOfMinute(current);
      if (until && current > until) break;
    }

    return occurrences;
  }

  getEventsInRange({ rangeStart, rangeEnd, calendarIds = [], search = '' } = {}) {
    const start = parseDateTime(rangeStart);
    const end = parseDateTime(rangeEnd);
    if (!start || !end) return [];

    const raw = this.listEventsRaw({ calendarIds, search });
    const items = [];
    for (const event of raw) {
      if (event.calendar_visible === 0) continue;
      items.push(...this._expandEvent(event, start, end));
    }
    return items.sort((a, b) => new Date(a.occurrence_start) - new Date(b.occurrence_start));
  }

  getUpcomingOccurrences(minutesAhead = 60) {
    const now = new Date();
    const future = new Date(now.getTime() + minutesAhead * 60 * 1000);
    return this.getEventsInRange({
      rangeStart: now.toISOString(),
      rangeEnd: future.toISOString()
    });
  }

  createEvent(data) {
    const stmt = this.db.prepare(`
      INSERT INTO events (
        calendar_id, title, description, location, start_at, end_at, all_day,
        recurrence_type, recurrence_interval, recurrence_until, recurrence_count, reminder_minutes, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(
      data.calendar_id,
      data.title,
      data.description || '',
      data.location || '',
      normalizeDateTime(data.start_at),
      normalizeDateTime(data.end_at),
      data.all_day ? 1 : 0,
      data.recurrence_type || 'none',
      Math.max(1, Number(data.recurrence_interval || 1)),
      normalizeDateTime(data.recurrence_until),
      data.recurrence_count ? Number(data.recurrence_count) : null,
      Number(data.reminder_minutes ?? 10)
    );
    return this.getEventById(info.lastInsertRowid);
  }

  updateEvent(id, data) {
    this.db.prepare(`
      UPDATE events SET
        calendar_id = ?,
        title = ?,
        description = ?,
        location = ?,
        start_at = ?,
        end_at = ?,
        all_day = ?,
        recurrence_type = ?,
        recurrence_interval = ?,
        recurrence_until = ?,
        recurrence_count = ?,
        reminder_minutes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.calendar_id,
      data.title,
      data.description || '',
      data.location || '',
      normalizeDateTime(data.start_at),
      normalizeDateTime(data.end_at),
      data.all_day ? 1 : 0,
      data.recurrence_type || 'none',
      Math.max(1, Number(data.recurrence_interval || 1)),
      normalizeDateTime(data.recurrence_until),
      data.recurrence_count ? Number(data.recurrence_count) : null,
      Number(data.reminder_minutes ?? 10),
      id
    );
    return this.getEventById(id);
  }

  moveEvent(id, { start_at, end_at, all_day }) {
    const ev = this.getEventById(id);
    if (!ev) return null;
    const payload = {
      calendar_id: ev.calendar_id,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      start_at: start_at ?? ev.start_at,
      end_at: end_at ?? ev.end_at,
      all_day: all_day ?? ev.all_day,
      recurrence_type: ev.recurrence_type,
      recurrence_interval: ev.recurrence_interval,
      recurrence_until: ev.recurrence_until,
      recurrence_count: ev.recurrence_count,
      reminder_minutes: ev.reminder_minutes
    };
    return this.updateEvent(id, payload);
  }

  deleteEvent(id) {
    this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
  }

  getSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
  }

  getSetting(key, fallback = null) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  }

  setSetting(key, value) {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  }

  markNotified(eventId, occurrenceStart) {
    this.db.prepare(`
      INSERT OR IGNORE INTO notification_log (event_id, occurrence_start, notified_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(eventId, occurrenceStart);
  }

  hasNotified(eventId, occurrenceStart) {
    return !!this.db.prepare(`
      SELECT 1 FROM notification_log WHERE event_id = ? AND occurrence_start = ?
    `).get(eventId, occurrenceStart);
  }

  eventsToNotify(minutesAhead = 15) {
    const now = new Date();
    const future = new Date(now.getTime() + minutesAhead * 60 * 1000);
    return this.getEventsInRange({
      rangeStart: now.toISOString(),
      rangeEnd: future.toISOString()
    }).filter((item) => {
      if (!item.reminder_minutes || Number(item.reminder_minutes) <= 0) return false;
      const occStart = new Date(item.occurrence_start).getTime();
      const diffMins = (occStart - now.getTime()) / 60000;
      return diffMins <= Number(item.reminder_minutes) && diffMins >= -1;
    }).filter((item) => !this.hasNotified(item.id, item.occurrence_start));
  }

  close() {
    try { this.db.close(); } catch (_) {}
  }
}

module.exports = {
  CalendarDB,
  toLocalInputDateTime,
  normalizeDateTime,
  parseDateTime,
};
