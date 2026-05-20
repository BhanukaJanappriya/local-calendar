
const api = window.calendarAPI;

export const CalendarAPI = {
  bootstrap: () => api.bootstrap(),
  listCalendars: () => api.listCalendars(),
  saveCalendar: (calendar) => api.saveCalendar(calendar),
  deleteCalendar: (id) => api.deleteCalendar(id),
  toggleCalendar: (payload) => api.toggleCalendar(payload),
  listEvents: (args) => api.listEvents(args),
  getEvent: (id) => api.getEvent(id),
  createEvent: (data) => api.createEvent(data),
  updateEvent: (payload) => api.updateEvent(payload),
  moveEvent: (payload) => api.moveEvent(payload),
  deleteEvent: (id) => api.deleteEvent(id),
  getSetting: (key, fallback) => api.getSetting(key, fallback),
  setSetting: (payload) => api.setSetting(payload),
  focusApp: () => api.focusApp(),
  onToday: (handler) => api.onToday(handler),
  onFocusEvent: (handler) => api.onFocusEvent(handler),
};
