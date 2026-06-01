const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const legacyDataDir = path.join(root, 'data');
const fontsDir = path.join(root, 'fonts');

let dataDir;
let todosPath;
let settingsPath;
let backupDir;

const defaultSettings = {
  widget: {
    fontFamily: 'system',
    fontSize: 14,
    glassOpacity: 0.14,
    blurStrength: 36,
    cornerRadius: 24,
    sortByDdl: false,
    bounds: {
      width: 430,
      height: 340,
      x: 36,
      y: 80
    }
  },
  panel: {
    fontFamily: 'system',
    fontSize: 14,
    glassOpacity: 0.20,
    blurStrength: 18,
    cornerRadius: 22,
    bounds: {
      width: 780,
      height: 640
    }
  },
  windowLevel: 'desktop'
};

let widgetWindow;
let panelWindow;
let tray;

function resolvePaths() {
  dataDir = path.join(app.getPath('userData'), 'data');
  todosPath = path.join(dataDir, 'todos.json');
  settingsPath = path.join(dataDir, 'settings.json');
  backupDir = path.join(dataDir, 'backups');
}

function baseTodoData() {
  return { active: [], completed: {}, removed: [] };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonDirect(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function mergeSettings(current = {}, patch = {}) {
  return {
    ...defaultSettings,
    ...current,
    ...patch,
    widget: {
      ...defaultSettings.widget,
      ...(current.widget || {}),
      ...(patch.widget || {}),
      bounds: {
        ...defaultSettings.widget.bounds,
        ...((current.widget || {}).bounds || {}),
        ...((patch.widget || {}).bounds || {})
      }
    },
    panel: {
      ...defaultSettings.panel,
      ...(current.panel || {}),
      ...(patch.panel || {}),
      bounds: {
        ...defaultSettings.panel.bounds,
        ...((current.panel || {}).bounds || {}),
        ...((patch.panel || {}).bounds || {})
      }
    },
    windowLevel: patch.windowLevel ?? current.windowLevel ?? defaultSettings.windowLevel
  };
}

function ensureDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(fontsDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  const legacyTodosPath = path.join(legacyDataDir, 'todos.json');
  const legacySettingsPath = path.join(legacyDataDir, 'settings.json');

  if (!fs.existsSync(todosPath)) {
    if (fs.existsSync(legacyTodosPath)) {
      fs.copyFileSync(legacyTodosPath, todosPath);
    } else {
      writeJsonDirect(todosPath, baseTodoData());
    }
  }

  if (!fs.existsSync(settingsPath)) {
    if (fs.existsSync(legacySettingsPath)) {
      const legacy = readJson(legacySettingsPath, defaultSettings);
      writeJsonDirect(settingsPath, mergeSettings(legacy));
    } else {
      writeJsonDirect(settingsPath, defaultSettings);
    }
  } else {
    const raw = readJson(settingsPath, defaultSettings);
    writeJsonDirect(settingsPath, mergeSettings(raw));
  }
}

function stamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function todayKey() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function atomicWriteJson(file, value, withBackup = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (withBackup && fs.existsSync(file)) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(file, path.join(backupDir, `todos_${stamp()}.json`));

    const backups = fs.readdirSync(backupDir)
      .filter(name => name.startsWith('todos_') && name.endsWith('.json'))
      .sort()
      .reverse();

    for (const old of backups.slice(30)) {
      fs.rmSync(path.join(backupDir, old), { force: true });
    }
  }

  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function normalizeDdl(value) {
  const v = String(value || '').trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return `${v}:00`;
  return v;
}

function normalizeTodo(todo) {
  return {
    id: todo.id,
    content: String(todo.content || '').trim(),
    ddl: normalizeDdl(todo.ddl),
    detail: String(todo.detail || '').trim()
  };
}

function broadcastTodos() {
  const todos = readJson(todosPath, baseTodoData());
  widgetWindow?.webContents.send('todos:changed', todos);
  panelWindow?.webContents.send('todos:changed', todos);
}

function broadcastSettings() {
  const settings = readJson(settingsPath, defaultSettings);
  widgetWindow?.webContents.send('settings:changed', settings);
  panelWindow?.webContents.send('settings:changed', settings);
}

function applyWindowLevel(settings) {
  const level = settings.windowLevel || 'desktop';

  if (widgetWindow) {
    widgetWindow.setAlwaysOnTop(level === 'topmost', level === 'topmost' ? 'screen-saver' : undefined);
    widgetWindow.setSkipTaskbar(true);
  }

  if (panelWindow) {
    panelWindow.setAlwaysOnTop(level === 'topmost', level === 'topmost' ? 'screen-saver' : undefined);
    panelWindow.setSkipTaskbar(level === 'desktop');
  }
}

function saveWidgetBounds() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  const current = readJson(settingsPath, defaultSettings);
  const bounds = widgetWindow.getBounds();

  const next = mergeSettings(current, {
    widget: {
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    }
  });

  atomicWriteJson(settingsPath, next, false);
  broadcastSettings();
}

function createWindows() {
  const settings = readJson(settingsPath, defaultSettings);
  const ws = settings.widget || defaultSettings.widget;
  const ps = settings.panel || defaultSettings.panel;
  const wb = ws.bounds || defaultSettings.widget.bounds;
  const pb = ps.bounds || defaultSettings.panel.bounds;

  widgetWindow = new BrowserWindow({
    width: wb.width || 430,
    height: wb.height || 340,
    x: Number.isFinite(wb.x) ? wb.x : 36,
    y: Number.isFinite(wb.y) ? wb.y : 80,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    show: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow.loadFile(path.join(root, 'src', 'widget.html'));
  widgetWindow.on('moved', saveWidgetBounds);

  panelWindow = new BrowserWindow({
    width: pb.width || 780,
    height: pb.height || 640,
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWindow.loadFile(path.join(root, 'src', 'panel.html'));

  panelWindow.on('close', event => {
    if (!app.isQuiting) {
      event.preventDefault();
      panelWindow.hide();
    }
  });

  panelWindow.on('enter-full-screen', () => {
    panelWindow?.webContents.send('panel:fullscreen-changed', true);
  });

  panelWindow.on('leave-full-screen', () => {
    panelWindow?.webContents.send('panel:fullscreen-changed', false);
  });

  applyWindowLevel(settings);
}

function createTray() {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect x="9" y="9" width="46" height="46" rx="14" fill="rgba(255,255,255,.88)"/>
      <path d="M22 33l7 7 15-18" fill="none" stroke="rgba(20,20,24,.86)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `);

  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);

  tray = new Tray(icon);
  tray.setToolTip('TodoLite');
  tray.on('click', togglePanel);

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open TodoLite', click: showPanel },
    {
      label: 'Show / Hide Desktop Layer',
      click: () => widgetWindow?.isVisible() ? widgetWindow.hide() : widgetWindow.show()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]));
}

function showPanel() {
  if (!panelWindow) return;
  panelWindow.show();
  panelWindow.focus();
}

function togglePanel() {
  if (!panelWindow) return;
  panelWindow.isVisible() ? panelWindow.hide() : showPanel();
}

function scanProjectFonts() {
  try {
    return fs.readdirSync(fontsDir, { withFileTypes: true })
      .filter(f => f.isFile() && /\.(ttf|otf|woff|woff2)$/i.test(f.name))
      .map(f => ({
        name: path.parse(f.name).name,
        file: f.name,
        url: `file://${path.join(fontsDir, f.name).replace(/\\/g, '/')}`,
        system: false
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

ipcMain.handle('todos:get', () => readJson(todosPath, baseTodoData()));
ipcMain.handle('settings:get', () => readJson(settingsPath, defaultSettings));
ipcMain.handle('fonts:list', () => ({ project: scanProjectFonts(), system: [] }));

ipcMain.handle('todos:add', (_, todo) => {
  const data = readJson(todosPath, baseTodoData());

  const item = normalizeTodo({
    ...todo,
    id: `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`
  });

  if (!item.content || !item.ddl) return data;

  data.active = data.active || [];
  data.active.unshift(item);

  atomicWriteJson(todosPath, data, true);
  broadcastTodos();

  return data;
});

ipcMain.handle('todos:update', (_, todo) => {
  const data = readJson(todosPath, baseTodoData());
  const item = normalizeTodo(todo);

  if (!item.id || !item.content || !item.ddl) return data;

  data.active = (data.active || []).map(x => x.id === item.id ? item : x);

  for (const key of Object.keys(data.completed || {})) {
    data.completed[key] = data.completed[key].map(x => x.id === item.id ? item : x);
  }

  data.removed = (data.removed || []).map(x => x.id === item.id ? item : x);

  atomicWriteJson(todosPath, data, true);
  broadcastTodos();

  return data;
});

ipcMain.handle('todos:complete', (_, id) => {
  const data = readJson(todosPath, baseTodoData());
  data.active = data.active || [];
  data.completed = data.completed || {};

  const idx = data.active.findIndex(item => item.id === id);

  if (idx >= 0) {
    const [todo] = data.active.splice(idx, 1);
    const key = todayKey();

    data.completed[key] = data.completed[key] || [];
    data.completed[key].unshift(todo);

    atomicWriteJson(todosPath, data, true);
    broadcastTodos();
  }

  return data;
});

ipcMain.handle('todos:restore', (_, id) => {
  const data = readJson(todosPath, baseTodoData());
  data.active = data.active || [];
  data.completed = data.completed || {};

  for (const key of Object.keys(data.completed)) {
    const idx = data.completed[key].findIndex(item => item.id === id);

    if (idx >= 0) {
      const [todo] = data.completed[key].splice(idx, 1);

      if (data.completed[key].length === 0) {
        delete data.completed[key];
      }

      data.active.unshift(todo);
      break;
    }
  }

  atomicWriteJson(todosPath, data, true);
  broadcastTodos();

  return data;
});

ipcMain.handle('todos:remove', (_, id) => {
  const data = readJson(todosPath, baseTodoData());

  data.active = data.active || [];
  data.completed = data.completed || {};
  data.removed = data.removed || [];

  const move = arr => {
    const idx = arr.findIndex(item => item.id === id);

    if (idx >= 0) {
      const [todo] = arr.splice(idx, 1);
      data.removed.unshift(todo);
      return true;
    }

    return false;
  };

  if (!move(data.active)) {
    for (const key of Object.keys(data.completed)) {
      if (move(data.completed[key])) {
        if (data.completed[key].length === 0) {
          delete data.completed[key];
        }
        break;
      }
    }
  }

  atomicWriteJson(todosPath, data, true);
  broadcastTodos();

  return data;
});

ipcMain.handle('settings:update', (_, patch) => {
  const current = readJson(settingsPath, defaultSettings);
  const settings = mergeSettings(current, patch || {});

  atomicWriteJson(settingsPath, settings, false);
  applyWindowLevel(settings);
  broadcastSettings();

  return settings;
});

ipcMain.handle('folder:open-data', () => shell.openPath(dataDir));
ipcMain.handle('folder:open-backups', () => shell.openPath(backupDir));
ipcMain.handle('app:close-panel', () => panelWindow?.hide());
ipcMain.handle('app:minimize-panel', () => panelWindow?.minimize());

ipcMain.handle('app:fullscreen-panel', () => {
  if (!panelWindow) return false;

  const next = !panelWindow.isFullScreen();
  panelWindow.setFullScreen(next);
  panelWindow.webContents.send('panel:fullscreen-changed', next);

  return next;
});

ipcMain.handle('app:panel-fullscreen-state', () => {
  return panelWindow?.isFullScreen() || false;
});

ipcMain.handle('app:quit', () => {
  app.isQuiting = true;
  app.quit();
});

app.whenReady().then(() => {
  resolvePaths();
  ensureDataFiles();
  createWindows();
  createTray();
});

app.on('window-all-closed', () => {
  // Keep tray app alive.
});