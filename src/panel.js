let todos = { active: [], completed: {}, removed: [] };
let settings = {};
let fonts = { project: [], system: [] };
let editingId = '';

const panel = document.querySelector('.panel');
const activeList = document.getElementById('activeList');
const completedList = document.getElementById('completedList');
const editor = document.getElementById('editor');
const form = document.getElementById('form');
const content = document.getElementById('content');
const ddl = document.getElementById('ddl');
const detail = document.getElementById('detail');
const deleteBtn = document.getElementById('deleteBtn');
const tlFull = document.getElementById('tlFull');

const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' }
];

const windowLevelOptions = [
  { value: 'desktop', label: 'desktop' },
  { value: 'normal', label: 'normal' },
  { value: 'topmost', label: 'topmost' }
];

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

function setCssVar(target, name, value) {
  document.documentElement.style.setProperty(name, value);
  if (target) target.style.setProperty(name, value);
}

function applyGlobalSettings(global) {
  const g = global || {};

  const family = g.fontFamily && g.fontFamily !== 'system'
    ? `'${g.fontFamily}', 'Segoe UI', system-ui, sans-serif`
    : `Inter, 'Segoe UI', system-ui, sans-serif`;

  document.documentElement.lang = g.language || 'zh-CN';
  document.documentElement.style.setProperty('--font-family', family);
  document.documentElement.style.setProperty('--font-size', `${g.fontSize || 14}px`);

  document.body.style.fontFamily = family;
  document.body.style.fontSize = `${g.fontSize || 14}px`;
}

function applyPanelGlass(ps) {
  setCssVar(panel, '--opacity', String(ps.glassOpacity ?? .20));
  setCssVar(panel, '--blur', `${ps.blurStrength ?? 18}px`);
  setCssVar(panel, '--radius', `${ps.cornerRadius ?? 22}px`);
}

function applySettings(s) {
  settings = s || {};

  applyGlobalSettings(settings.global || {});
  applyPanelGlass(settings.panel || {});
  syncSettingsUI();
}

function syncSettingsUI() {
  const g = settings.global || {};
  const ws = settings.widget || {};
  const ps = settings.panel || {};

  setVal('globalFontSize', g.fontSize || 14);
  setVal('widgetGlassOpacity', ws.glassOpacity ?? .14);
  setVal('widgetBlurStrength', ws.blurStrength ?? 36);
  setVal('widgetCornerRadius', ws.cornerRadius ?? 24);
  setVal('panelGlassOpacity', ps.glassOpacity ?? .20);
  setVal('panelBlurStrength', ps.blurStrength ?? 18);
  setVal('panelCornerRadius', ps.cornerRadius ?? 22);

  updateFontSelected();
  updateLanguageSelected();
  updateWindowLevelSelected();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && String(el.value) !== String(val)) {
    el.value = val;
  }
}

function updateFontSelected() {
  const g = settings.global || {};
  const name = g.fontFamily || 'system';
  const selected = document.getElementById('globalFontSelected');

  selected.textContent = name;
  selected.style.fontFamily = name !== 'system' ? `'${name}', sans-serif` : '';
}

function updateLanguageSelected() {
  const value = settings.global?.language || 'zh-CN';
  const option = languageOptions.find(item => item.value === value) || languageOptions[0];
  document.getElementById('languageSelected').textContent = option.label;
}

function updateWindowLevelSelected() {
  const value = settings.windowLevel || 'desktop';
  const option = windowLevelOptions.find(item => item.value === value) || windowLevelOptions[0];
  document.getElementById('windowLevelSelected').textContent = option.label;
}

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

function closeAllLiquidSelects(except) {
  document.querySelectorAll('.liquid-select.open').forEach(item => {
    if (item !== except) item.classList.remove('open');
  });
}

function initLiquidSelect({ rootId, triggerId, listId, options, getValue, onChange }) {
  const root = document.getElementById(rootId);
  const trigger = document.getElementById(triggerId);
  const list = document.getElementById(listId);

  function renderOptions() {
    const current = getValue();
    list.innerHTML = '';

    for (const option of options) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'liquid-option' + (option.value === current ? ' active' : '');
      item.textContent = option.label;

      item.onclick = async event => {
        event.stopPropagation();
        root.classList.remove('open');
        await onChange(option.value);
      };

      list.appendChild(item);
    }
  }

  trigger.onclick = event => {
    event.stopPropagation();

    const isOpen = root.classList.contains('open');
    closeAllLiquidSelects(root);
    root.classList.toggle('open', !isOpen);

    if (!isOpen) renderOptions();
  };
}

function buildFontList(filter) {
  const list = document.getElementById('globalFontList');
  list.innerHTML = '';

  const f = (filter || '').toLowerCase();
  const projectFiltered = (fonts.project || []).filter(font => !f || font.name.toLowerCase().includes(f));
  const currentFont = (settings.global || {}).fontFamily || 'system';

  function addOption(font) {
    const opt = document.createElement('button');

    opt.type = 'button';
    opt.className = 'liquid-option' + (font.name === currentFont ? ' active' : '');
    opt.textContent = font.name;
    opt.style.fontFamily = font.name !== 'system' ? `'${font.name}', sans-serif` : '';

    opt.onclick = async () => {
      const next = await window.todoLite.updateSettings({
        global: {
          fontFamily: font.name
        }
      });

      applySettings(next);

      document.getElementById('globalFontDropdown').classList.remove('open');
      document.getElementById('globalFontSearch').value = '';
    };

    list.appendChild(opt);
  }

  addOption({ name: 'system' });

  if (projectFiltered.length) {
    const sep = document.createElement('div');
    sep.className = 'liquid-sep';
    sep.textContent = 'fonts';
    list.appendChild(sep);

    projectFiltered.forEach(addOption);
  }

  if (!projectFiltered.length && f) {
    const empty = document.createElement('div');
    empty.className = 'liquid-empty';
    empty.textContent = 'no match';
    list.appendChild(empty);
  }

  if (!projectFiltered.length && !f) {
    const empty = document.createElement('div');
    empty.className = 'liquid-empty';
    empty.textContent = 'put .ttf / .otf / .woff in fonts';
    list.appendChild(empty);
  }
}

function initFontDropdown() {
  const dropdown = document.getElementById('globalFontDropdown');
  const selected = document.getElementById('globalFontSelected');
  const search = document.getElementById('globalFontSearch');

  selected.onclick = event => {
    event.stopPropagation();

    const wasOpen = dropdown.classList.contains('open');
    closeAllLiquidSelects(dropdown);
    dropdown.classList.toggle('open', !wasOpen);

    if (!wasOpen) {
      search.value = '';
      buildFontList('');
      requestAnimationFrame(() => search.focus());
    }
  };

  search.oninput = () => buildFontList(search.value);

  search.onkeydown = event => {
    if (event.key === 'Escape') {
      dropdown.classList.remove('open');
    }
  };
}

function makeTask(item, done = false) {
  const row = document.createElement('div');
  row.className = `task ${done ? 'done' : ''}`;

  row.innerHTML = `
    <div class="check"></div>
    <div class="meta">
      <div class="title"></div>
      <div class="detail"></div>
    </div>
    <div class="ddl"></div>
  `;

  row.querySelector('.title').textContent = item.content;
  row.querySelector('.detail').textContent = item.detail || '';
  row.querySelector('.ddl').textContent = item.ddl;

  row.querySelector('.meta').onclick = () => row.classList.toggle('open');
  row.querySelector('.meta').ondblclick = () => openEditor(item);
  row.querySelector('.ddl').ondblclick = () => openEditor(item);

  row.querySelector('.check').onclick = () => {
    done ? window.todoLite.restoreTodo(item.id) : window.todoLite.completeTodo(item.id);
  };

  return row;
}

function render() {
  const active = [...(todos.active || [])].sort((a, b) => String(a.ddl).localeCompare(String(b.ddl)));

  activeList.innerHTML = '<div class="section-title">active</div>';

  if (!active.length) {
    activeList.innerHTML += '<div class="empty">nothing active</div>';
  } else {
    active.forEach(item => activeList.appendChild(makeTask(item, false)));
  }

  completedList.innerHTML = '<div class="section-title">completed by date</div>';

  const keys = Object.keys(todos.completed || {}).sort().reverse();

  if (!keys.length) {
    completedList.innerHTML += '<div class="empty">no completed record</div>';
  }

  for (const key of keys) {
    const card = document.createElement('div');
    card.className = 'date-card';

    const title = document.createElement('div');
    title.className = 'date-title';
    title.textContent = key;

    card.appendChild(title);

    for (const item of todos.completed[key]) {
      card.appendChild(makeTask(item, true));
    }

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

function setFullscreenIconState(isFull) {
  tlFull.classList.toggle('is-fullscreen', !!isFull);
  tlFull.title = isFull ? 'restore' : 'maximize';
}

function updateLiquidSpot(event) {
  if (!panel) return;

  const rect = panel.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  panel.style.setProperty('--spot-x', `${x}%`);
  panel.style.setProperty('--spot-y', `${y}%`);
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

  if (editingId) {
    await window.todoLite.updateTodo({
      id: editingId,
      ...payload
    });
  } else {
    await window.todoLite.addTodo(payload);
  }

  editor.close();
};

deleteBtn.onclick = async () => {
  if (editingId) {
    await window.todoLite.removeTodo(editingId);
  }

  editor.close();
};

document.getElementById('cancelBtn').onclick = () => editor.close();
document.getElementById('newBtn').onclick = () => openEditor();
document.getElementById('openData').onclick = () => window.todoLite.openDataFolder();
document.getElementById('openBackups').onclick = () => window.todoLite.openBackupFolder();

document.getElementById('tlClose').onclick = () => window.todoLite.closePanel();
document.getElementById('tlMin').onclick = () => window.todoLite.minimizePanel();

tlFull.onclick = async () => {
  const isFull = await window.todoLite.fullscreenPanel();
  setFullscreenIconState(isFull);
};

for (const btn of document.querySelectorAll('.nav')) {
  btn.onclick = () => {
    document.querySelectorAll('.nav').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.getElementById('tasksPage').classList.toggle('hidden', btn.dataset.page !== 'tasks');
    document.getElementById('settingsPage').classList.toggle('hidden', btn.dataset.page !== 'settings');
  };
}

for (const [id, path] of [
  ['globalFontSize', 'global.fontSize'],
  ['widgetGlassOpacity', 'widget.glassOpacity'],
  ['widgetBlurStrength', 'widget.blurStrength'],
  ['widgetCornerRadius', 'widget.cornerRadius'],
  ['panelGlassOpacity', 'panel.glassOpacity'],
  ['panelBlurStrength', 'panel.blurStrength'],
  ['panelCornerRadius', 'panel.cornerRadius']
]) {
  const el = document.getElementById(id);

  el.oninput = async event => {
    const [section, key] = path.split('.');

    const next = await window.todoLite.updateSettings({
      [section]: {
        [key]: Number(event.target.value)
      }
    });

    applySettings(next);
  };
}

panel?.addEventListener('pointermove', updateLiquidSpot);

document.addEventListener('click', () => {
  closeAllLiquidSelects();
});

window.todoLite.onTodosChanged(data => {
  todos = data;
  render();
});

window.todoLite.onSettingsChanged(data => {
  applySettings(data);
});

window.todoLite.onPanelFullscreenChanged(isFull => {
  setFullscreenIconState(isFull);
});

(async function init() {
  fonts = await window.todoLite.listFonts();
  injectProjectFonts(fonts.project || []);

  todos = await window.todoLite.getTodos();
  settings = await window.todoLite.getSettings();

  applySettings(settings);
  initFontDropdown();

  initLiquidSelect({
    rootId: 'languageDropdown',
    triggerId: 'languageSelected',
    listId: 'languageList',
    options: languageOptions,
    getValue: () => settings.global?.language || 'zh-CN',
    onChange: async value => {
      const next = await window.todoLite.updateSettings({
        global: {
          language: value
        }
      });
      applySettings(next);
    }
  });

  initLiquidSelect({
    rootId: 'windowLevelDropdown',
    triggerId: 'windowLevelSelected',
    listId: 'windowLevelList',
    options: windowLevelOptions,
    getValue: () => settings.windowLevel || 'desktop',
    onChange: async value => {
      const next = await window.todoLite.updateSettings({
        windowLevel: value
      });
      applySettings(next);
    }
  });

  render();

  const isFull = await window.todoLite.getPanelFullscreenState();
  setFullscreenIconState(isFull);
})();