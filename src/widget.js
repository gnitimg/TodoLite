let todos = { active: [], completed: {}, removed: [] };
let settings = {};
let sortByDdl = false;

const list = document.getElementById('list');
const editor = document.getElementById('editor');
const form = document.getElementById('form');
const content = document.getElementById('content');
const ddl = document.getElementById('ddl');
const detail = document.getElementById('detail');

function toLocalInput(value) {
  return (value || '').replace(' ', 'T');
}

function fromLocalInput(value) {
  return (value || '').replace('T', ' ');
}

function applySettings(s) {
  settings = s || {};
  document.documentElement.style.setProperty('--font-size', `${settings.fontSize || 14}px`);
  document.documentElement.style.setProperty('--opacity', settings.glassOpacity ?? .34);
  document.documentElement.style.setProperty('--blur', `${settings.blurStrength || 28}px`);
  document.documentElement.style.setProperty('--radius', `${settings.cornerRadius || 28}px`);
  document.documentElement.style.setProperty('--font-family', settings.fontFamily && settings.fontFamily !== 'system' ? `'${settings.fontFamily}', 'Segoe UI', system-ui, sans-serif` : `Inter, 'Segoe UI', system-ui, sans-serif`);
}

function sortItems(items) {
  if (!sortByDdl) return [...items];
  return [...items].sort((a, b) => String(a.ddl).localeCompare(String(b.ddl)));
}

function render() {
  const active = sortItems(todos.active || []);
  list.innerHTML = '';
  if (!active.length) {
    list.innerHTML = '<div class="empty">nothing left</div>';
    return;
  }
  for (const item of active) {
    const row = document.createElement('div');
    row.className = 'todo';
    row.innerHTML = `
      <div class="check" title="done"></div>
      <div class="content">
        <div class="content-title"></div>
        <div class="detail"></div>
      </div>
      <div class="ddl"></div>
    `;
    row.querySelector('.content-title').textContent = item.content;
    row.querySelector('.detail').textContent = item.detail || '';
    row.querySelector('.ddl').textContent = item.ddl;
    row.querySelector('.check').onclick = async event => {
      event.stopPropagation();
      row.classList.add('done-fade');
      setTimeout(() => window.todoLite.completeTodo(item.id), 180);
    };
    row.querySelector('.content').onclick = () => row.classList.toggle('open');
    row.querySelector('.content').ondblclick = () => openEditor(item);
    list.appendChild(row);
  }
}

function openEditor(item) {
  editor.dataset.editId = item?.id || '';
  content.value = item?.content || '';
  ddl.value = toLocalInput(item?.ddl) || '';
  detail.value = item?.detail || '';
  editor.showModal();
  content.focus();
}

form.onsubmit = async event => {
  event.preventDefault();
  if (!content.value.trim() || !ddl.value) return;
  const payload = { content: content.value.trim(), ddl: fromLocalInput(ddl.value), detail: detail.value.trim() };
  if (editor.dataset.editId) await window.todoLite.updateTodo({ id: editor.dataset.editId, ...payload });
  else await window.todoLite.addTodo(payload);
  editor.close();
};

document.getElementById('cancelBtn').onclick = () => editor.close();
document.getElementById('addBtn').onclick = () => openEditor();
document.getElementById('sortBtn').onclick = () => { sortByDdl = !sortByDdl; render(); };

window.todoLite.onTodosChanged(data => { todos = data; render(); });
window.todoLite.onSettingsChanged(data => applySettings(data));

(async function init() {
  todos = await window.todoLite.getTodos();
  settings = await window.todoLite.getSettings();
  applySettings(settings);
  render();
})();
