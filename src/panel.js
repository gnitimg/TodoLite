let todos = { active: [], completed: {}, removed: [] };
let settings = {};
let fonts = { project: [], system: [] };
let editingId = '';

const activeList = document.getElementById('activeList');
const completedList = document.getElementById('completedList');
const editor = document.getElementById('editor');
const form = document.getElementById('form');
const content = document.getElementById('content');
const ddl = document.getElementById('ddl');
const detail = document.getElementById('detail');
const deleteBtn = document.getElementById('deleteBtn');

function toLocalInput(value) { return (value || '').replace(' ', 'T'); }
function fromLocalInput(value) { return (value || '').replace('T', ' '); }

function applySettings(s) {
  settings = s || {};
  const ps = settings.panel || {};
  document.documentElement.style.setProperty('--font-size', `${ps.fontSize || 14}px`);
  document.documentElement.style.setProperty('--opacity', ps.glassOpacity ?? .20);
  document.documentElement.style.setProperty('--blur', `${ps.blurStrength || 18}px`);
  document.documentElement.style.setProperty('--radius', `${ps.cornerRadius || 22}px`);
  const ws = settings.widget || {};
  document.documentElement.style.setProperty('--font-family',
    ws.fontFamily && ws.fontFamily !== 'system'
      ? `'${ws.fontFamily}', 'Segoe UI', system-ui, sans-serif`
      : `Inter, 'Segoe UI', system-ui, sans-serif`);
  syncSettingsUI();
}

function syncSettingsUI() {
  const ws = settings.widget || {};
  const ps = settings.panel || {};
  setVal('widgetFontSize', ws.fontSize || 14);
  setVal('widgetGlassOpacity', ws.glassOpacity ?? .14);
  setVal('widgetBlurStrength', ws.blurStrength || 36);
  setVal('widgetCornerRadius', ws.cornerRadius || 24);
  setVal('panelGlassOpacity', ps.glassOpacity ?? .20);
  setVal('panelBlurStrength', ps.blurStrength || 18);
  setVal('panelCornerRadius', ps.cornerRadius || 22);
  document.getElementById('windowLevel').value = settings.windowLevel || 'desktop';
  updateFontSelected();
}
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

function updateFontSelected() {
  const ws = settings.widget || {};
  const name = ws.fontFamily || 'system';
  document.getElementById('widgetFontSelected').textContent = name;
  document.getElementById('widgetFontSelected').style.fontFamily =
    name !== 'system' ? `'${name}', sans-serif` : '';
}

function injectProjectFonts(list) {
  if (!list.length) return;
  const style = document.createElement('style');
  style.textContent = list.map(f =>
    `@font-face{font-family:'${f.name}';src:url('${f.url}');font-display:swap;}`
  ).join('\n');
  document.head.appendChild(style);
}

function buildFontList(filter) {
  const list = document.getElementById('widgetFontList');
  list.innerHTML = '';
  const f = (filter || '').toLowerCase();
  const projectFiltered = fonts.project.filter(font => !f || font.name.toLowerCase().includes(f));
  const systemFiltered = fonts.system.filter(font => !f || font.name.toLowerCase().includes(f));
  const currentFont = (settings.widget || {}).fontFamily || 'system';

  function addOption(font) {
    const opt = document.createElement('div');
    opt.className = 'font-option' + (font.name === currentFont ? ' active' : '');
    opt.textContent = font.name;
    opt.style.fontFamily = font.system ? `'${font.name}', sans-serif` : `'${font.name}', sans-serif`;
    opt.onclick = () => {
      window.todoLite.updateSettings({ widget: { fontFamily: font.name } });
      document.getElementById('widgetFontDropdown').classList.remove('open');
      document.getElementById('widgetFontSearch').value = '';
    };
    list.appendChild(opt);
  }

  function addSystemDefault() {
    const opt = document.createElement('div');
    opt.className = 'font-option' + (currentFont === 'system' ? ' active' : '');
    opt.textContent = 'system';
    opt.onclick = () => {
      window.todoLite.updateSettings({ widget: { fontFamily: 'system' } });
      document.getElementById('widgetFontDropdown').classList.remove('open');
      document.getElementById('widgetFontSearch').value = '';
    };
    list.appendChild(opt);
  }

  addSystemDefault();

  if (projectFiltered.length) {
    const sep = document.createElement('div');
    sep.className = 'font-sep';
    sep.textContent = 'project';
    list.appendChild(sep);
    projectFiltered.forEach(addOption);
  }
  if (systemFiltered.length) {
    const sep = document.createElement('div');
    sep.className = 'font-sep';
    sep.textContent = 'system';
    list.appendChild(sep);
    systemFiltered.forEach(addOption);
  }
  if (!projectFiltered.length && !systemFiltered.length && f) {
    const empty = document.createElement('div');
    empty.className = 'font-option';
    empty.textContent = 'no match';
    empty.style.color = 'var(--muted)';
    list.appendChild(empty);
  }
}

function initFontDropdown() {
  const dropdown = document.getElementById('widgetFontDropdown');
  const selected = document.getElementById('widgetFontSelected');
  const search = document.getElementById('widgetFontSearch');

  selected.onclick = e => {
    e.stopPropagation();
    const wasOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open');
    if (!wasOpen) { search.value = ''; search.focus(); buildFontList(''); }
  };

  search.oninput = () => buildFontList(search.value);
  search.onkeydown = e => { if (e.key === 'Escape') dropdown.classList.remove('open'); };

  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target)) dropdown.classList.remove('open');
  });
}

function makeTask(item, done = false) {
  const row = document.createElement('div');
  row.className = `task ${done ? 'done' : ''}`;
  row.innerHTML = `
    <div class="check"></div>
    <div class="meta"><div class="title"></div><div class="detail"></div></div>
    <div class="ddl"></div>
  `;
  row.querySelector('.title').textContent = item.content;
  row.querySelector('.detail').textContent = item.detail || '';
  row.querySelector('.ddl').textContent = item.ddl;
  row.querySelector('.meta').onclick = () => row.classList.toggle('open');
  row.querySelector('.meta').ondblclick = () => openEditor(item);
  row.querySelector('.ddl').ondblclick = () => openEditor(item);
  row.querySelector('.check').onclick = () => done ? window.todoLite.restoreTodo(item.id) : window.todoLite.completeTodo(item.id);
  return row;
}

function render() {
  const active = [...(todos.active || [])].sort((a, b) => String(a.ddl).localeCompare(String(b.ddl)));
  activeList.innerHTML = '<div class="section-title">active</div>';
  if (!active.length) activeList.innerHTML += '<div class="empty">nothing active</div>';
  else active.forEach(item => activeList.appendChild(makeTask(item, false)));

  completedList.innerHTML = '<div class="section-title">completed by date</div>';
  const keys = Object.keys(todos.completed || {}).sort().reverse();
  if (!keys.length) completedList.innerHTML += '<div class="empty">no completed record</div>';
  for (const key of keys) {
    const card = document.createElement('div');
    card.className = 'date-card';
    card.innerHTML = `<div class="date-title">${key}</div>`;
    for (const item of todos.completed[key]) card.appendChild(makeTask(item, true));
    completedList.appendChild(card);
  }
}

function openEditor(item) {
  editingId = item?.id || '';
  content.value = item?.content || '';
  ddl.value = toLocalInput(item?.ddl) || '';
  detail.value = item?.detail || '';
  deleteBtn.style.visibility = editingId ? 'visible' : 'hidden';
  editor.showModal();
  content.focus();
}

form.onsubmit = async event => {
  event.preventDefault();
  if (!content.value.trim() || !ddl.value) return;
  const payload = { content: content.value.trim(), ddl: fromLocalInput(ddl.value), detail: detail.value.trim() };
  if (editingId) await window.todoLite.updateTodo({ id: editingId, ...payload });
  else await window.todoLite.addTodo(payload);
  editor.close();
};

deleteBtn.onclick = async () => { if (editingId) await window.todoLite.removeTodo(editingId); editor.close(); };
document.getElementById('cancelBtn').onclick = () => editor.close();
document.getElementById('newBtn').onclick = () => openEditor();
document.getElementById('openData').onclick = () => window.todoLite.openDataFolder();
document.getElementById('openBackups').onclick = () => window.todoLite.openBackupFolder();

document.getElementById('tlClose').onclick = () => window.todoLite.closePanel();
document.getElementById('tlMin').onclick = () => window.todoLite.minimizePanel();
document.getElementById('tlFull').onclick = () => window.todoLite.fullscreenPanel();

for (const btn of document.querySelectorAll('.nav')) {
  btn.onclick = () => {
    document.querySelectorAll('.nav').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tasksPage').classList.toggle('hidden', btn.dataset.page !== 'tasks');
    document.getElementById('settingsPage').classList.toggle('hidden', btn.dataset.page !== 'settings');
  };
}

for (const [id, path] of [
  ['widgetFontSize', 'widget.fontSize'],
  ['widgetGlassOpacity', 'widget.glassOpacity'],
  ['widgetBlurStrength', 'widget.blurStrength'],
  ['widgetCornerRadius', 'widget.cornerRadius'],
  ['panelGlassOpacity', 'panel.glassOpacity'],
  ['panelBlurStrength', 'panel.blurStrength'],
  ['panelCornerRadius', 'panel.cornerRadius'],
]) {
  document.getElementById(id).oninput = event => {
    const [section, key] = path.split('.');
    window.todoLite.updateSettings({ [section]: { [key]: Number(event.target.value) } });
  };
}

document.getElementById('windowLevel').oninput = event => {
  window.todoLite.updateSettings({ windowLevel: event.target.value });
};

window.todoLite.onTodosChanged(data => { todos = data; render(); });
window.todoLite.onSettingsChanged(data => applySettings(data));

(async function init() {
  fonts = await window.todoLite.listFonts();
  injectProjectFonts(fonts.project);
  todos = await window.todoLite.getTodos();
  settings = await window.todoLite.getSettings();
  applySettings(settings);
  initFontDropdown();
  render();
})();
