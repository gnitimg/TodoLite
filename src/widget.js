let todos = { active: [], completed: {}, removed: [] };
let settings = {};
let sortByDdl = false;
let contextMenu = null;
let datePickerDialog = null;
let datePickerTarget = null;

const widget = document.querySelector('.widget');
const list = document.getElementById('list');
const editor = document.getElementById('editor');
const form = document.getElementById('form');
const content = document.getElementById('content');
const ddl = document.getElementById('ddl');
const detail = document.getElementById('detail');
const sortBtn = document.getElementById('sortBtn');

const i18n = {
  'zh-CN': {
    taskList: '任务列表',
    nothingLeft: '没有剩余任务',
    cancel: '取消',
    save: '保存',
    content: '内容',
    detail: '详情，可选',
    edit: '编辑',
    remove: '删除',
    selectTime: '选择时间',
    sortByDdl: '按 DDL 排序',
    sortOriginal: '恢复原顺序'
  },
  'en-US': {
    taskList: 'task list',
    nothingLeft: 'nothing left',
    cancel: 'cancel',
    save: 'save',
    content: 'content',
    detail: 'detail, optional',
    edit: 'edit',
    remove: 'delete',
    selectTime: 'select time',
    sortByDdl: 'Sort by DDL',
    sortOriginal: 'Sort by original order'
  }
};

function t(key) {
  const lang = settings.global?.language || 'zh-CN';
  return i18n[lang]?.[key] || i18n['zh-CN'][key] || key;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function defaultDdl() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 1);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

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

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp100(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function hexToRgb(hex) {
  const clean = String(hex || '#5f8cff').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(x => x + x).join('')
    : clean.padEnd(6, '0').slice(0, 6);

  const n = parseInt(full, 16);

  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
}

function setSurfaceVars(target, surface, global) {
  const opacity = clamp01(surface.glassOpacity ?? .14);
  const blur = clamp100(surface.blurStrength ?? 36);
  const radius = Number(surface.cornerRadius ?? 24);
  const accent = global.accentColor || '#5f8cff';
  const rgb = hexToRgb(accent);

  const mistOpacity = Math.min(0.62, blur / 130);
  const hazeOpacity = Math.min(0.52, blur / 155);
  const glowSize = 120 + blur * 2.4;

  const vars = {
    '--opacity': String(opacity),
    '--blur': `${blur}px`,
    '--radius': `${radius}px`,
    '--mist-opacity': String(mistOpacity),
    '--haze-opacity': String(hazeOpacity),
    '--glow-size': `${glowSize}px`,
    '--accent': accent,
    '--accent-rgb': `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    '--glass': `rgba(255,255,255,${opacity})`
  };

  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
    target?.style.setProperty(key, value);
  }
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

function applySettings(s) {
  settings = s || {};

  const ws = settings.widget || {};
  sortByDdl = !!ws.sortByDdl;

  applyGlobalSettings(settings.global || {});
  setSurfaceVars(widget, ws, settings.global || {});
  updateSortButton();
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  content.placeholder = t('content');
  detail.placeholder = t('detail');
}

function updateSortButton() {
  sortBtn.classList.toggle('active', sortByDdl);
  sortBtn.title = sortByDdl ? t('sortOriginal') : t('sortByDdl');
}

function sortItems(items) {
  if (!sortByDdl) return [...items];
  return [...items].sort((a, b) => String(a.ddl).localeCompare(String(b.ddl)));
}

function ensureContextMenu() {
  if (contextMenu) return contextMenu;

  contextMenu = document.createElement('div');
  contextMenu.className = 'task-context-menu glass no-drag';
  contextMenu.innerHTML = `
    <button type="button" data-action="edit">${t('edit')}</button>
    <button type="button" data-action="remove" class="danger">${t('remove')}</button>
  `;
  document.body.appendChild(contextMenu);

  document.addEventListener('click', hideContextMenu);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideContextMenu();
  });

  return contextMenu;
}

function hideContextMenu() {
  if (contextMenu) contextMenu.classList.remove('open');
}

function showContextMenu(event, item, row) {
  event.preventDefault();
  event.stopPropagation();

  const menu = ensureContextMenu();

  menu.querySelector('[data-action="edit"]').textContent = t('edit');
  menu.querySelector('[data-action="remove"]').textContent = t('remove');

  menu.querySelector('[data-action="edit"]').onclick = () => {
    hideContextMenu();
    openEditor(item);
  };

  menu.querySelector('[data-action="remove"]').onclick = () => {
    hideContextMenu();
    removeWithParticles(row, item.id);
  };

  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 132)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 88)}px`;
  menu.classList.add('open');
}

function removeWithParticles(row, id) {
  if (!row || row.classList.contains('particle-removing')) return;

  const rect = row.getBoundingClientRect();
  const count = 18;

  row.classList.add('particle-removing');

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle-dot';

    const x = rect.left + Math.random() * rect.width;
    const y = rect.top + Math.random() * rect.height;
    const dx = (Math.random() - 0.5) * 120;
    const dy = (Math.random() - 0.5) * 80 - 20;

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    p.style.animationDelay = `${Math.random() * 90}ms`;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 760);
  }

  setTimeout(async () => {
    await window.todoLite.removeTodo(id);
  }, 520);
}

function render() {
  const active = sortItems(todos.active || []);

  list.innerHTML = '';

  if (!active.length) {
    list.innerHTML = `<div class="empty">${t('nothingLeft')}</div>`;
    return;
  }

  for (const item of active) {
    const row = document.createElement('div');
    row.className = 'todo no-drag';

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
    row.oncontextmenu = event => showContextMenu(event, item, row);

    list.appendChild(row);
  }
}

function openEditor(item) {
  editor.dataset.editId = item?.id || '';

  content.value = item?.content || '';
  ddl.value = item?.ddl || defaultDdl();
  detail.value = item?.detail || '';

  editor.showModal();
  content.focus();
}

function ensureDatePicker() {
  if (datePickerDialog) return datePickerDialog;

  datePickerDialog = document.createElement('dialog');
  datePickerDialog.className = 'glass ddl-dialog no-drag';

  datePickerDialog.innerHTML = `
    <form method="dialog" class="ddl-form">
      <div class="dialog-title">${t('selectTime')}</div>
      <div class="ddl-grid">
        <input id="ddlYear" inputmode="numeric" maxlength="4" />
        <input id="ddlMonth" inputmode="numeric" maxlength="2" />
        <input id="ddlDay" inputmode="numeric" maxlength="2" />
        <input id="ddlHour" inputmode="numeric" maxlength="2" />
        <input id="ddlMinute" inputmode="numeric" maxlength="2" />
        <input id="ddlSecond" inputmode="numeric" maxlength="2" />
      </div>
      <div class="ddl-labels">
        <span>Y</span><span>M</span><span>D</span><span>H</span><span>M</span><span>S</span>
      </div>
      <div class="dialog-actions">
        <button type="button" id="ddlCancel">${t('cancel')}</button>
        <button type="submit">${t('save')}</button>
      </div>
    </form>
  `;

  document.body.appendChild(datePickerDialog);

  datePickerDialog.querySelector('#ddlCancel').onclick = () => datePickerDialog.close();

  datePickerDialog.querySelector('.ddl-form').onsubmit = event => {
    event.preventDefault();

    const y = datePickerDialog.querySelector('#ddlYear').value.padStart(4, '0');
    const mo = datePickerDialog.querySelector('#ddlMonth').value.padStart(2, '0');
    const d = datePickerDialog.querySelector('#ddlDay').value.padStart(2, '0');
    const h = datePickerDialog.querySelector('#ddlHour').value.padStart(2, '0');
    const mi = datePickerDialog.querySelector('#ddlMinute').value.padStart(2, '0');
    const s = datePickerDialog.querySelector('#ddlSecond').value.padStart(2, '0');

    if (datePickerTarget) {
      datePickerTarget.value = `${y}-${mo}-${d} ${h}:${mi}:${s}`;
    }

    datePickerDialog.close();
  };

  return datePickerDialog;
}

function openDatePicker(target) {
  datePickerTarget = target;

  const value = target.value || defaultDdl();
  const [date, time] = value.split(' ');
  const [y, mo, d] = (date || '').split('-');
  const [h, mi, s] = (time || '').split(':');

  const dialog = ensureDatePicker();

  dialog.querySelector('#ddlYear').value = y || '';
  dialog.querySelector('#ddlMonth').value = mo || '';
  dialog.querySelector('#ddlDay').value = d || '';
  dialog.querySelector('#ddlHour').value = h || '';
  dialog.querySelector('#ddlMinute').value = mi || '';
  dialog.querySelector('#ddlSecond').value = s || '00';

  dialog.showModal();
}

function updateLiquidSpot(event) {
  if (!widget) return;

  const rect = widget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  widget.style.setProperty('--spot-x', `${x}%`);
  widget.style.setProperty('--spot-y', `${y}%`);
}

function bindGlowLifecycle(surface) {
  if (!surface) return;

  surface.classList.add('is-idle');
  surface.classList.remove('is-lit');

  const lightOn = () => {
    surface.classList.remove('is-idle');
    surface.classList.add('is-lit');
  };

  const lightOff = () => {
    surface.classList.remove('is-lit');
    surface.classList.add('is-idle');
  };

  surface.addEventListener('mouseenter', lightOn);
  surface.addEventListener('pointerenter', lightOn);
  surface.addEventListener('mouseleave', lightOff);
  surface.addEventListener('pointerleave', lightOff);
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

ddl.onclick = () => openDatePicker(ddl);
ddl.onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openDatePicker(ddl);
  }
};

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

widget?.addEventListener('pointermove', updateLiquidSpot);

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
  bindGlowLifecycle(widget);
  render();
})();