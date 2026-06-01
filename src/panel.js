let todos = { active: [], completed: {}, removed: [] };
let settings = {};
let fonts = [];
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
  document.documentElement.style.setProperty('--font-size', `${settings.fontSize || 14}px`);
  document.documentElement.style.setProperty('--opacity', settings.glassOpacity ?? .34);
  document.documentElement.style.setProperty('--blur', `${settings.blurStrength || 28}px`);
  document.documentElement.style.setProperty('--radius', `${settings.cornerRadius || 28}px`);
  document.documentElement.style.setProperty('--font-family', settings.fontFamily && settings.fontFamily !== 'system' ? `'${settings.fontFamily}', 'Segoe UI', system-ui, sans-serif` : `Inter, 'Segoe UI', system-ui, sans-serif`);
  for (const [id, fallback] of [['fontSize', 14], ['glassOpacity', .34], ['blurStrength', 28], ['cornerRadius', 28]]) {
    const el = document.getElementById(id);
    if (el) el.value = settings[id] ?? fallback;
  }
  document.getElementById('windowLevel').value = settings.windowLevel || 'desktop';
  document.getElementById('fontFamily').value = settings.fontFamily || 'system';
}

function injectFonts(list) {
  const style = document.createElement('style');
  style.textContent = list.map(font => `@font-face{font-family:'${font.name}';src:url('${font.url}');}`).join('\n');
  document.head.appendChild(style);
  const select = document.getElementById('fontFamily');
  select.innerHTML = `<option value="system">system</option>` + list.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
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

deleteBtn.onclick = async () => {
  if (editingId) await window.todoLite.removeTodo(editingId);
  editor.close();
};
document.getElementById('cancelBtn').onclick = () => editor.close();
document.getElementById('newBtn').onclick = () => openEditor();
document.getElementById('closeBtn').onclick = () => window.todoLite.closePanel();
document.getElementById('openData').onclick = () => window.todoLite.openDataFolder();
document.getElementById('openBackups').onclick = () => window.todoLite.openBackupFolder();

for (const btn of document.querySelectorAll('.nav')) {
  btn.onclick = () => {
    document.querySelectorAll('.nav').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tasksPage').classList.toggle('hidden', btn.dataset.page !== 'tasks');
    document.getElementById('settingsPage').classList.toggle('hidden', btn.dataset.page !== 'settings');
  };
}

for (const id of ['fontSize', 'glassOpacity', 'blurStrength', 'cornerRadius', 'windowLevel', 'fontFamily']) {
  document.getElementById(id).oninput = event => {
    const value = event.target.type === 'range' ? Number(event.target.value) : event.target.value;
    window.todoLite.updateSettings({ [id]: value });
  };
}

window.todoLite.onTodosChanged(data => { todos = data; render(); });
window.todoLite.onSettingsChanged(data => applySettings(data));

(async function init() {
  fonts = await window.todoLite.listFonts();
  injectFonts(fonts);
  todos = await window.todoLite.getTodos();
  settings = await window.todoLite.getSettings();
  applySettings(settings);
  render();
})();
