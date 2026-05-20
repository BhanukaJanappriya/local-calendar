
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('calendarAPI', {
  bootstrap: () => ipcRenderer.invoke('app:getBootstrap'),
  listCalendars: () => ipcRenderer.invoke('calendars:list'),
  saveCalendar: (calendar) => ipcRenderer.invoke('calendars:save', calendar),
  deleteCalendar: (id) => ipcRenderer.invoke('calendars:delete', id),
  toggleCalendar: (payload) => ipcRenderer.invoke('calendars:toggle', payload),

  listEvents: (args) => ipcRenderer.invoke('events:list', args),
  getEvent: (id) => ipcRenderer.invoke('events:get', id),
  createEvent: (data) => ipcRenderer.invoke('events:create', data),
  updateEvent: (payload) => ipcRenderer.invoke('events:update', payload),
  moveEvent: (payload) => ipcRenderer.invoke('events:move', payload),
  deleteEvent: (id) => ipcRenderer.invoke('events:delete', id),

  getSetting: (key, fallback) => ipcRenderer.invoke('settings:get', key, fallback),
  setSetting: (payload) => ipcRenderer.invoke('settings:set', payload),

  focusApp: () => ipcRenderer.invoke('app:focus'),

  onToday: (handler) => {
    ipcRenderer.removeAllListeners('app:today');
    ipcRenderer.on('app:today', handler);
  },
  onFocusEvent: (handler) => {
    ipcRenderer.removeAllListeners('calendar:focus-event');
    ipcRenderer.on('calendar:focus-event', (_event, payload) => handler(payload));
  }
});
