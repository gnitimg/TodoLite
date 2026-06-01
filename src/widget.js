let todos = { active: [], completed: {}, removed: [] };
let settings = {};
let sortByDdl = false;

const list = document.getElementById('list');
const editor = document.getElementById('editor');
const form = document.getElementById('form');
const content = document.getElementById('content');
const ddl = document.getElementById('ddl');
const detail = document.getElementById('detail');
const sortBtn = document.getElementById('sortBtn');

function toLocalInput(value) {
  return String(value || '').replace(' ', 'T');
}

function fromLocalInput(value) {
  const v = String(value || '').trim().replace('T', ' ');

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) {
    return `${v}:00`;
  }

  return v;
}

function applySettings(s) {
  settings = s || {};

  const ws = settings.widget || {};

  sortByDdl = !!ws.sortByDdl;

  document.documentElement.style.setProperty('--font-size', `${ws.fontSize || 14}px`);
  document.documentElement.style.setProperty('--opacity', ws.glassOpacity ?? .14);
  document.documentElement.style.setProperty('--blur', `${ws.blurStrength || 36}px`);
  document.documentElement.style.setProperty('--radius', `${ws.cornerRadius || 24}px`);

  document.documentElement.style.setProperty(
    '--font-family',
    ws.fontFamily && ws.fontFamily !== 'system'
      ? `'${ws.fontFamily}', 'Segoe UI', system-ui, sans-serif`
      : `Inter, 'Segoe UI', system-ui, sans-serif`
  );

  updateSortButton();
}

function updateSortButton() {
  sortBtn.classList.toggle('active', sortByDdl);
  sortBtn.title = sortByDdl ? 'Sort by original order' : 'Sort by DDL';
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

      row.classList.add('done-sweep');

      setTimeout(() => {
        row.classList.add('done-fade');

        setTimeout(() => {
          window.todoLite.completeTodo(item.id);
        }, 340);
      }, 550);
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

  if (!content.value.trim() || !ddl.value) {
    return;
  }

  const payload = {
    content: content.value.trim(),
    ddl: fromLocalInput(ddl.value),
    detail: detail.value.trim()
  };

  if (editor.dataset.editId) {
    await window.todoLite.updateTodo({
      id: editor.dataset.editId,
      ...payload
    });
  } else {
    await window.todoLite.addTodo(payload);
  }

  editor.close();
};

document.getElementById('cancelBtn').onclick = () => editor.close();
document.getElementById('addBtn').onclick = () => openEditor();

sortBtn.onclick = async () => {
  const nextValue = !sortByDdl;

  const next = await window.todoLite.updateSettings({
    widget: {
      sortByDdl: nextValue
    }
  });

  applySettings(next);
  render();
};

window.todoLite.onTodosChanged(data => {
  todos = data;
  render();
});

window.todoLite.onSettingsChanged(data => {
  applySettings(data);
  render();
});

function injectProjectFonts(list) {
  if (!list.length) return;

  const old = document.getElementById('projectFontsStyle');
  if (old) old.remove();

  const style = document.createElement('style');
  style.id = 'projectFontsStyle';
  style.textContent = list.map(f =>
    `@font-face{font-family:'${f.name}';src:url('${f.url}');font-display:swap;}`
  ).join('\n');

  document.head.appendChild(style);
}

(async function init() {
  const fontData = await window.todoLite.listFonts();
  injectProjectFonts(fontData.project || []);

  todos = await window.todoLite.getTodos();
  settings = await window.todoLite.getSettings();

  applySettings(settings);
  render();
})();