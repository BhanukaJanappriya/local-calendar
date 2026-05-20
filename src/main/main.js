
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { CalendarDB } = require('./database');

let mainWindow = null;
let tray = null;
let db = null;
let reminderTimer = null;

function loadIcon() {
  const pngPath = path.join(__dirname, '../../assets/icon.png');
  if (fs.existsSync(pngPath)) {
    return nativeImage.createFromPath(pngPath);
  }
  return nativeImage.createEmpty();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f7fbf7',
    title: 'Local Calendar',
    show: false,
    icon: loadIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuiting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = loadIcon();
  tray = new Tray(icon);
  tray.setToolTip('Local Calendar');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Calendar', click: () => showMainWindow() },
    { label: 'Today', click: () => mainWindow?.webContents.send('app:today') },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.isQuiting = true;
      app.quit();
    } }
  ]));
  tray.on('double-click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function startReminderLoop() {
  const tick = () => {
    if (!db) return;
    const items = db.eventsToNotify(20);
    for (const item of items) {
      const title = item.title;
      const when = new Date(item.occurrence_start);
      const whenText = when.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: item.all_day ? undefined : '2-digit',
        minute: item.all_day ? undefined : '2-digit'
      });
      const notification = new Notification({
        title: `Upcoming event: ${title}`,
        body: `${item.calendar_name} • ${whenText}${item.location ? ` • ${item.location}` : ''}`,
        silent: false
      });
      notification.on('click', () => {
        showMainWindow();
        mainWindow?.webContents.send('calendar:focus-event', {
          id: item.id,
          occurrenceStart: item.occurrence_start
        });
      });
      notification.show();
      db.markNotified(item.id, item.occurrence_start);
    }
  };
  tick();
  reminderTimer = setInterval(tick, 60 * 1000);
}

function registerIpc() {
  ipcMain.handle('app:getBootstrap', () => ({
    calendars: db.getCalendars(),
    settings: db.getSettings()
  }));

  ipcMain.handle('calendars:list', () => db.getCalendars());

  ipcMain.handle('calendars:save', (_event, calendar) => db.upsertCalendar(calendar));

  ipcMain.handle('calendars:delete', (_event, id) => {
    db.deleteCalendar(id);
    return true;
  });

  ipcMain.handle('calendars:toggle', (_event, { id, visible }) => {
    db.updateCalendarVisibility(id, visible);
    return db.getCalendars();
  });

  ipcMain.handle('events:list', (_event, args) => db.getEventsInRange(args));
  ipcMain.handle('events:get', (_event, id) => db.getEventById(id));
  ipcMain.handle('events:create', (_event, data) => db.createEvent(data));
  ipcMain.handle('events:update', (_event, { id, data }) => db.updateEvent(id, data));
  ipcMain.handle('events:move', (_event, { id, data }) => db.moveEvent(id, data));
  ipcMain.handle('events:delete', (_event, id) => {
    db.deleteEvent(id);
    return true;
  });

  ipcMain.handle('settings:get', (_event, key, fallback) => db.getSetting(key, fallback));
  ipcMain.handle('settings:set', (_event, { key, value }) => {
    db.setSetting(key, value);
    return true;
  });

  ipcMain.handle('app:focus', () => {
    showMainWindow();
    return true;
  });
}

app.setAppUserModelId('com.local.calendar.desktop');

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'calendar.sqlite');
  db = new CalendarDB(dbPath);
  registerIpc();
  createWindow();
  createTray();
  startReminderLoop();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (reminderTimer) clearInterval(reminderTimer);
  if (tray) tray.destroy();
  if (db) db.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
