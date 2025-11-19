const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
const POS_FILE = path.join(app.getPath('userData'), 'winpos.json');

function loadPosition() {
  try {
    const raw = fs.readFileSync(POS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function savePosition(bounds) {
  try {
    fs.writeFileSync(POS_FILE, JSON.stringify(bounds));
  } catch (e) { }
}

function createWindow() {
  const saved = loadPosition();
  win = new BrowserWindow({
    width: 420,
    height: 220,
    x: saved ? saved.x : 50,
    y: saved ? saved.y : 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'floating');
  win.setMenu(null);

  // Save position when moved
  win.on('move', () => {
    try {
      const b = win.getBounds();
      savePosition(b);
    } catch (e) { }
  });

  // Poll cursor position for eyes
  setInterval(() => {
    if (win && !win.isDestroyed()) {
      const point = screen.getCursorScreenPoint();
      win.webContents.send('cursor-pos', point);
    }
  }, 30);

  // Handle resize requests from renderer
  ipcMain.on('resize-window', (event, height) => {
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds();
      // Enforce min height for header, but trust renderer for max height (it implements the 5-task limit)
      const newHeight = Math.max(height, 80);
      if (bounds.height !== newHeight) {
        win.setSize(bounds.width, newHeight);
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Global quit shortcut (Cmd/Ctrl+Shift+Q)
  const quitShortcut = process.platform === 'darwin' ? 'CommandOrControl+Shift+Q' : 'Control+Shift+Q';
  globalShortcut.register(quitShortcut, () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
