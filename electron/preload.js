const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, cb) {
  const listener = (_, data) => cb(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('todoLite', {
  getTodos: () => ipcRenderer.invoke('todos:get'),
  addTodo: todo => ipcRenderer.invoke('todos:add', todo),
  updateTodo: todo => ipcRenderer.invoke('todos:update', todo),
  completeTodo: id => ipcRenderer.invoke('todos:complete', id),
  restoreTodo: id => ipcRenderer.invoke('todos:restore', id),
  removeTodo: id => ipcRenderer.invoke('todos:remove', id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),

  listFonts: () => ipcRenderer.invoke('fonts:list'),

  openDataFolder: () => ipcRenderer.invoke('folder:open-data'),
  openBackupFolder: () => ipcRenderer.invoke('folder:open-backups'),

  closePanel: () => ipcRenderer.invoke('app:close-panel'),
  minimizePanel: () => ipcRenderer.invoke('app:minimize-panel'),
  fullscreenPanel: () => ipcRenderer.invoke('app:fullscreen-panel'),
  getPanelFullscreenState: () => ipcRenderer.invoke('app:panel-fullscreen-state'),

  quit: () => ipcRenderer.invoke('app:quit'),

  onTodosChanged: cb => subscribe('todos:changed', cb),
  onSettingsChanged: cb => subscribe('settings:changed', cb),
  onPanelFullscreenChanged: cb => subscribe('panel:maximize-changed', cb)
});
