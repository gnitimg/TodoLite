const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const fontsDir = path.join(root, 'fonts');
const todosPath = path.join(dataDir, 'todos.json');
const settingsPath = path.join(dataDir, 'settings.json');
const backupDir = path.join(dataDir, 'backups');

let widgetWindow;
let panelWindow;
let tray;

function ensureDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(fontsDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  if (!fs.existsSync(todosPath)) {
    fs.writeFileSync(todosPath, JSON.stringify({ active: [], completed: {}, removed: [] }, null, 2));
  }
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({
      fontFamily: 'system', fontSize: 14, glassOpacity: 0.34, blurStrength: 28,
      cornerRadius: 28, animation: true, windowLevel: 'desktop'
    }, null, 2));
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function stamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
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
    for (const old of backups.slice(30)) fs.rmSync(path.join(backupDir, old), { force: true });
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function broadcastTodos() {
  const todos = readJson(todosPath, { active: [], completed: {}, removed: [] });
  widgetWindow?.webContents.send('todos:changed', todos);
  panelWindow?.webContents.send('todos:changed', todos);
}

function broadcastSettings() {
  const settings = readJson(settingsPath, {});
  widgetWindow?.webContents.send('settings:changed', settings);
  panelWindow?.webContents.send('settings:changed', settings);
}

function applyWindowLevel(settings) {
  const windows = [widgetWindow, panelWindow].filter(Boolean);
  for (const win of windows) {
    if (settings.windowLevel === 'topmost') win.setAlwaysOnTop(true, 'screen-saver');
    else win.setAlwaysOnTop(false);
  }
}

function createWindows() {
  const settings = readJson(settingsPath, {});

  widgetWindow = new BrowserWindow({
    width: 430,
    height: 340,
    x: 36,
    y: 80,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  widgetWindow.loadFile(path.join(root, 'src', 'widget.html'));

  panelWindow = new BrowserWindow({
    width: 780,
    height: 640,
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

  applyWindowLevel(settings);
}

function createTray() {
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect x='9' y='9' width='46' height='46' rx='14' fill='rgba(255,255,255,.85)'/><path d='M22 33l7 7 15-18' fill='none' stroke='rgba(20,20,24,.86)' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/></svg>`);
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`);
  tray = new Tray(icon);
  tray.setToolTip('TodoLite');
  tray.on('click', togglePanel);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open TodoLite', click: showPanel },
    { label: 'Show / Hide Desktop Layer', click: () => widgetWindow?.isVisible() ? widgetWindow.hide() : widgetWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
  ]));
}

function showPanel() {
  if (!panelWindow) return;
  panelWindow.show();
  panelWindow.focus();
}

function togglePanel() {
  if (!panelWindow) return;
  if (panelWindow.isVisible()) panelWindow.hide();
  else showPanel();
}

ipcMain.handle('todos:get', () => readJson(todosPath, { active: [], completed: {}, removed: [] }));
ipcMain.handle('settings:get', () => readJson(settingsPath, {}));
ipcMain.handle('fonts:list', () => {
  const files = fs.readdirSync(fontsDir, { withFileTypes: true })
    .filter(f => f.isFile() && /\.(ttf|otf|woff|woff2)$/i.test(f.name))
    .map(f => ({ name: path.parse(f.name).name, file: f.name, url: `file://${path.join(fontsDir, f.name).replace(/\\/g, '/')}` }));
  return files;
});

ipcMain.handle('todos:add', (_, todo) => {
  const data = readJson(todosPath, { active: [], completed: {}, removed: [] });
  data.active.unshift({ id: `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`, content: todo.content, ddl: todo.ddl, detail: todo.detail || '' });
  atomicWriteJson(todosPath, data, true);
  broadcastTodos();
  return data;
});

ipcMain.handle('todos:update', (_, todo) => {
  const data = readJson(todosPath, { active: [], completed: {}, removed: [] });
  data.active = data.active.map(item => item.id === todo.id ? { ...item, content: todo.content, ddl: todo.ddl, detail: todo.detail || '' } : item);
  for (const key of Object.keys(data.completed || {})) {
    data.completed[key] = data.completed[key].map(item => item.id === todo.id ? { ...item, content: todo.content, ddl: todo.ddl, detail: todo.detail || '' } : item);
  }
  atomicWriteJson(todosPath, data, true);
  broadcastTodos();
  return data;
});

ipcMain.handle('todos:complete', (_, id) => {
  const data = readJson(todosPath, { active: [], completed: {}, removed: [] });
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
  const data = readJson(todosPath, { active: [], completed: {}, removed: [] });
  for (const key of Object.keys(data.completed || {})) {
    const idx = data.completed[key].findIndex(item => item.id === id);
    if (idx >= 0) {
      const [todo] = data.completed[key].splice(idx, 1);
      if (data.completed[key].length === 0) delete data.completed[key];
      data.active.unshift(todo);
      break;
    }
  }
  atomicWriteJson(todosPath, data, true);
  broadcastTodos();
  return data;
});

ipcMain.handle('todos:remove', (_, id) => {
  const data = readJson(todosPath, { active: [], completed: {}, removed: [] });
  const move = arr => {
    const idx = arr.findIndex(item => item.id === id);
    if (idx >= 0) {
      const [todo] = arr.splice(idx, 1);
      data.removed = data.removed || [];
      data.removed.unshift(todo);
      return true;
    }
    return false;
  };
  if (!move(data.active)) {
    for (const key of Object.keys(data.completed || {})) {
      if (move(data.completed[key])) {
        if (data.completed[key].length === 0) delete data.completed[key];
        break;
      }
    }
  }
  atomicWriteJson(todosPath, data, true);
  broadcastTodos();
  return data;
});

ipcMain.handle('settings:update', (_, patch) => {
  const settings = { ...readJson(settingsPath, {}), ...patch };
  atomicWriteJson(settingsPath, settings, false);
  applyWindowLevel(settings);
  broadcastSettings();
  return settings;
});

ipcMain.handle('folder:open-data', () => shell.openPath(dataDir));
ipcMain.handle('folder:open-backups', () => shell.openPath(backupDir));
ipcMain.handle('app:close-panel', () => panelWindow?.hide());
ipcMain.handle('app:quit', () => { app.isQuiting = true; app.quit(); });

app.whenReady().then(() => {
  ensureDataFiles();
  createWindows();
  createTray();
});

app.on('window-all-closed', event => event.preventDefault());
