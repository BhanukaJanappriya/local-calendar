# Local Calendar Desktop

A polished, offline-first desktop calendar application built with Electron, SQLite, and vanilla web technologies.

## Project Overview

*   **Technology Stack:**
    *   **Frontend:** Vanilla JavaScript, HTML5, CSS3.
    *   **Backend (Main Process):** Node.js, Electron.
    *   **Database:** SQLite via `better-sqlite3`.
    *   **Packaging:** `electron-builder`.
*   **Architecture:**
    *   **Main Process (`src/main/main.js`):** Manages the application lifecycle, system tray, notifications, and IPC handlers.
    *   **Database Logic (`src/main/database.js`):** Encapsulates all SQLite operations, including schema management, event expansion (recurrence), and settings.
    *   **IPC Bridge (`src/main/preload.js` & `src/renderer/api.js`):** Securely exposes database and app functionality to the renderer process via `contextBridge`.
    *   **Renderer Process (`src/renderer/`):** A single-page application (SPA) using vanilla DOM manipulation and custom state management.

## Key Features

*   **Offline First:** All data is stored locally in a SQLite database.
*   **Recurrence Engine:** Supports daily, weekly, monthly, and yearly recurring events, expanded at runtime.
*   **System Integration:** Includes a system tray icon with a context menu and native desktop notifications for upcoming events.
*   **Customizable:** Supports calendar categories with custom colors and visibility toggling.

## Building and Running

### Development
```bash
# Install dependencies
npm install

# Run the application in development mode
npm start
# OR
npm run dev
```

### Packaging & Distribution
```bash
# Create a local build (unpacked)
npm run package

# Create distribution artifacts (ZIP, Installer)
npm run dist
```
*Note: Build artifacts are output to the `dist/` directory.*

## Development Conventions

*   **Secure IPC:** Never use `remote` module or `nodeIntegration: true`. Always use `contextBridge` and `ipcRenderer.invoke/handle`.
*   **Database Management:**
    *   Database is located in the Electron `userData` folder as `calendar.sqlite`.
    *   Use WAL (Write-Ahead Logging) mode for better performance.
    *   Schema updates should be handled in `src/main/database.js`.
*   **State Management:** The renderer uses a central `state` object and manual DOM updates. Avoid adding external frameworks unless requested.
*   **Recurrence Logic:** Recurrence expansion occurs in the `Main` process within `CalendarDB._expandEvent` to ensure consistency between the UI and notification loops.

## File Structure Highlights

*   `src/main/main.js`: Entry point, window/tray management.
*   `src/main/database.js`: SQLite schema and data access logic.
*   `src/main/preload.js`: The secure bridge between Main and Renderer.
*   `src/renderer/app.js`: Main UI logic and state handling.
*   `src/renderer/utils.js`: Date manipulation and UI helper functions.
