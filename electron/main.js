const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, screen } = require('electron');
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
  global: {
    fontFamily: 'system',
    fontSize: 14,
    language: 'zh-CN',
    accentColor: '#5f8cff',
    startup: false
  },
  widget: {
    glassOpacity: 0.14,
    blurStrength: 36,
    cornerRadius: 24,
    sortByDdl: false,
    layer: 'desktop',
    bounds: {
      width: 430,
      height: 340,
      x: 36,
      y: 80
    }
  },
  panel: {
    glassOpacity: 0.20,
    blurStrength: 18,
    cornerRadius: 22,
    bounds: {
      width: 780,
      height: 640
    }
  }
};

let widgetWindow;
let panelWindow;
let tray;
let widgetBoundsTimer = null;
let panelBoundsTimer = null;
let panelZoomed = false;
let panelRestoreBounds = null;
let panelAnimating = false;

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

function cleanUndefined(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      cleanUndefined(obj[key]);
    }
  }

  return obj;
}

function migrateSettings(raw = {}) {
  const oldFontFamily = raw.fontFamily || raw.global?.fontFamily || raw.widget?.fontFamily || raw.panel?.fontFamily;
  const oldFontSize = raw.fontSize || raw.global?.fontSize || raw.widget?.fontSize || raw.panel?.fontSize;
  const oldWindowLevel = raw.windowLevel || raw.widget?.layer || defaultSettings.widget.layer;

  const migrated = {
    ...defaultSettings,
    ...raw,
    global: {
      ...defaultSettings.global,
      ...(raw.global || {}),
      fontFamily: oldFontFamily || defaultSettings.global.fontFamily,
      fontSize: oldFontSize || defaultSettings.global.fontSize,
      language: raw.global?.language || raw.language || defaultSettings.global.language,
      accentColor: raw.global?.accentColor || raw.accentColor || defaultSettings.global.accentColor,
      startup: Boolean(raw.global?.startup ?? raw.startup ?? defaultSettings.global.startup)
    },
    widget: {
      ...defaultSettings.widget,
      ...(raw.widget || {}),
      fontFamily: undefined,
      fontSize: undefined,
      layer: raw.widget?.layer || oldWindowLevel,
      bounds: {
        ...defaultSettings.widget.bounds,
        ...((raw.widget || {}).bounds || {})
      }
    },
    panel: {
      ...defaultSettings.panel,
      ...(raw.panel || {}),
      fontFamily: undefined,
      fontSize: undefined,
      bounds: {
        ...defaultSettings.panel.bounds,
        ...((raw.panel || {}).bounds || {})
      }
    },
    windowLevel: undefined
  };

  return cleanUndefined(migrated);
}

function mergeSettings(current = {}, patch = {}) {
  const base = migrateSettings(current);

  const merged = {
    ...base,
    ...patch,
    global: {
      ...defaultSettings.global,
      ...(base.global || {}),
      ...(patch.global || {})
    },
    widget: {
      ...defaultSettings.widget,
      ...(base.widget || {}),
      ...(patch.widget || {}),
      bounds: {
        ...defaultSettings.widget.bounds,
        ...((base.widget || {}).bounds || {}),
        ...((patch.widget || {}).bounds || {})
      }
    },
    panel: {
      ...defaultSettings.panel,
      ...(base.panel || {}),
      ...(patch.panel || {}),
      bounds: {
        ...defaultSettings.panel.bounds,
        ...((base.panel || {}).bounds || {}),
        ...((patch.panel || {}).bounds || {})
      }
    },
    windowLevel: undefined
  };

  return cleanUndefined(merged);
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
  const settings = mergeSettings(readJson(settingsPath, defaultSettings));
  widgetWindow?.webContents.send('settings:changed', settings);
  panelWindow?.webContents.send('settings:changed', settings);
}

function applyStartup(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: false,
      path: process.execPath
    });
  } catch {
    // Dev / portable environments may fail silently.
  }
}

function getStartupStateFromSystem() {
  try {
    return Boolean(app.getLoginItemSettings().openAtLogin);
  } catch {
    return false;
  }
}

function getWidgetLayer() {
  const settings = mergeSettings(readJson(settingsPath, defaultSettings));
  return settings.widget?.layer || 'desktop';
}

function enforceWidgetTrayOnly() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  widgetWindow.setSkipTaskbar(true);

  setTimeout(() => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    widgetWindow.setSkipTaskbar(true);
  }, 80);

  setTimeout(() => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    widgetWindow.setSkipTaskbar(true);
  }, 260);
}

function applyWidgetLayer(settings) {
  const layer = settings.widget?.layer || 'desktop';

  if (!widgetWindow) return;

  widgetWindow.setSkipTaskbar(true);

  if (layer === 'topmost') {
    widgetWindow.setFocusable(true);
    widgetWindow.setAlwaysOnTop(true, 'screen-saver');
    widgetWindow.show();
    enforceWidgetTrayOnly();
    return;
  }

  widgetWindow.setAlwaysOnTop(false);

  if (layer === 'normal') {
    widgetWindow.setFocusable(true);
    widgetWindow.show();
    enforceWidgetTrayOnly();
    return;
  }

  // desktop：最低干扰层，只控制小 TodoList。
  // 这里不置顶、不进任务栏、不抢焦点。
  widgetWindow.setFocusable(false);
  widgetWindow.showInactive();
  enforceWidgetTrayOnly();

  setTimeout(() => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    widgetWindow.setFocusable(true);
    widgetWindow.blur();
    enforceWidgetTrayOnly();
  }, 260);
}

function saveBounds(kind) {
  const win = kind === 'widget' ? widgetWindow : panelWindow;
  if (!win || win.isDestroyed()) return;

  const current = readJson(settingsPath, defaultSettings);
  const bounds = win.getBounds();

  const next = mergeSettings(current, {
    [kind]: {
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

function debounceSaveBounds(kind) {
  if (kind === 'widget') {
    clearTimeout(widgetBoundsTimer);
    widgetBoundsTimer = setTimeout(() => saveBounds('widget'), 220);
  } else {
    clearTimeout(panelBoundsTimer);
    panelBoundsTimer = setTimeout(() => saveBounds('panel'), 220);
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateWindowBounds(win, target, duration = 260, done) {
  if (!win || win.isDestroyed() || panelAnimating) return;

  panelAnimating = true;

  const from = win.getBounds();
  const start = Date.now();

  const tick = () => {
    if (!win || win.isDestroyed()) {
      panelAnimating = false;
      return;
    }

    const p = Math.min(1, (Date.now() - start) / duration);
    const e = easeOutCubic(p);

    const next = {
      x: Math.round(from.x + (target.x - from.x) * e),
      y: Math.round(from.y + (target.y - from.y) * e),
      width: Math.round(from.width + (target.width - from.width) * e),
      height: Math.round(from.height + (target.height - from.height) * e)
    };

    win.setBounds(next, false);

    if (p < 1) {
      setTimeout(tick, 1000 / 60);
    } else {
      panelAnimating = false;
      if (typeof done === 'function') done();
    }
  };

  tick();
}

function getPanelZoomTarget() {
  const display = screen.getDisplayMatching(panelWindow.getBounds());
  const area = display.workArea;

  return {
    x: area.x + 10,
    y: area.y + 10,
    width: area.width - 20,
    height: area.height - 20
  };
}

function showPanel() {
  if (!panelWindow) return;

  panelWindow.setSkipTaskbar(false);
  panelWindow.show();
  panelWindow.focus();
}

function hidePanel() {
  if (!panelWindow) return;

  panelWindow.hide();
  panelWindow.setSkipTaskbar(true);
}

function togglePanel() {
  if (!panelWindow) return;
  panelWindow.isVisible() ? hidePanel() : showPanel();
}

function createWindows() {
  const settings = mergeSettings(readJson(settingsPath, defaultSettings));
  const ws = settings.widget || defaultSettings.widget;
  const ps = settings.panel || defaultSettings.panel;
  const wb = ws.bounds || defaultSettings.widget.bounds;
  const pb = ps.bounds || defaultSettings.panel.bounds;

  widgetWindow = new BrowserWindow({
    width: wb.width || 430,
    height: wb.height || 340,
    x: Number.isFinite(wb.x) ? wb.x : 36,
    y: Number.isFinite(wb.y) ? wb.y : 80,
    minWidth: 260,
    minHeight: 160,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow.loadFile(path.join(root, 'src', 'widget.html'));
  widgetWindow.on('show', enforceWidgetTrayOnly);
  widgetWindow.on('focus', enforceWidgetTrayOnly);
  widgetWindow.on('restore', enforceWidgetTrayOnly);

  widgetWindow.once('ready-to-show', () => {
    applyWidgetLayer(settings);
  });

  widgetWindow.on('moved', () => debounceSaveBounds('widget'));
  widgetWindow.on('resized', () => debounceSaveBounds('widget'));

  widgetWindow.on('minimize', event => {
    if (getWidgetLayer() === 'desktop') {
      event.preventDefault();
      setTimeout(() => {
        if (!widgetWindow || widgetWindow.isDestroyed()) return;
        widgetWindow.showInactive();
        widgetWindow.blur();
      }, 80);
    }
  });

  widgetWindow.on('hide', () => {
    if (getWidgetLayer() === 'desktop' && !app.isQuiting) {
      setTimeout(() => {
        if (!widgetWindow || widgetWindow.isDestroyed()) return;
        widgetWindow.showInactive();
        widgetWindow.blur();
      }, 120);
    }
  });

  panelWindow = new BrowserWindow({
    width: pb.width || 780,
    height: pb.height || 640,
    minWidth: 620,
    minHeight: 460,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    hasShadow: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWindow.loadFile(path.join(root, 'src', 'panel.html'));

  panelWindow.on('moved', () => debounceSaveBounds('panel'));
  panelWindow.on('resized', () => debounceSaveBounds('panel'));

  panelWindow.on('close', event => {
    if (!app.isQuiting) {
      event.preventDefault();
      hidePanel();
    }
  });
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
      click: () => {
        if (!widgetWindow) return;

        if (widgetWindow.isVisible()) {
          widgetWindow.hide();
          return;
        }

        widgetWindow.showInactive();
        enforceWidgetTrayOnly();
      }
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
ipcMain.handle('settings:get', () => {
  const settings = mergeSettings(readJson(settingsPath, defaultSettings));
  settings.global.startup = getStartupStateFromSystem();
  return settings;
});
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
  applyStartup(settings.global?.startup);
  applyWidgetLayer(settings);
  broadcastSettings();

  return settings;
});

ipcMain.handle('folder:open-data', () => shell.openPath(dataDir));
ipcMain.handle('folder:open-backups', () => shell.openPath(backupDir));
ipcMain.handle('app:close-panel', () => hidePanel());
ipcMain.handle('app:minimize-panel', () => panelWindow?.minimize());

ipcMain.handle('app:fullscreen-panel', () => {
  if (!panelWindow || panelAnimating) return panelZoomed;

  if (panelZoomed) {
    const target = panelRestoreBounds || mergeSettings(readJson(settingsPath, defaultSettings)).panel.bounds;
    panelZoomed = false;
    panelWindow.webContents.send('panel:maximize-changed', false);
    animateWindowBounds(panelWindow, target, 260, () => debounceSaveBounds('panel'));
    return false;
  }

  panelRestoreBounds = panelWindow.getBounds();
  const target = getPanelZoomTarget();

  panelZoomed = true;
  panelWindow.webContents.send('panel:maximize-changed', true);
  animateWindowBounds(panelWindow, target, 260);

  return true;
});

ipcMain.handle('app:panel-fullscreen-state', () => panelZoomed);

ipcMain.handle('app:quit', () => {
  app.isQuiting = true;
  app.quit();
});

app.whenReady().then(() => {
  resolvePaths();
  ensureDataFiles();

  const settings = mergeSettings(readJson(settingsPath, defaultSettings));
  applyStartup(settings.global?.startup);

  createWindows();
  createTray();
});

app.on('window-all-closed', () => {
  // Keep tray app alive.
});