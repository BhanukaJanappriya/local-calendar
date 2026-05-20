# Local Calendar Desktop

A polished offline desktop calendar app built with Electron, HTML, CSS, JavaScript, Node.js, and SQLite.

## Features

- Month, week, day, and agenda views
- Create, edit, delete events
- All-day events
- Recurring events
- Drag-and-drop rescheduling
- Search and calendar filtering
- Color-coded calendars
- Local SQLite storage only
- System tray support
- Reminder notifications
- Responsive, workspace-style UI

## Folder structure

```text
local-calendar-desktop/
├─ package.json
├─ README.md
├─ assets/
│  ├─ icon.png
│  └─ icon.svg
└─ src/
   ├─ main/
   │  ├─ main.js
   │  ├─ preload.js
   │  └─ database.js
   └─ renderer/
      ├─ index.html
      ├─ styles.css
      ├─ app.js
      ├─ api.js
      └─ utils.js
```

## Setup

```bash
npm install
npm start
```

## Build / package

```bash
npm run package
npm run dist
```

Electron Builder is configured to output ZIP artifacts for Windows, macOS, and Linux where supported.

## Notes

- Events are stored in the Electron user data folder as `calendar.sqlite`.
- The app works fully offline.
- Calendar visibility, accent color, and last selected view/date are stored locally.
- Recurring events are expanded locally in the renderer and notification loop.

## Local data path

The SQLite database is created automatically at app startup inside the Electron `userData` directory.

## Packaging into a ZIP

After running `npm run dist`, the generated installer and ZIP artifacts will be placed in the `dist/` folder.
