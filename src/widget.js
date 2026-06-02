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
  const safeName = safeFontName(g.fontFamily || 'system');

  const family = g.fontFamily && g.fontFamily !== 'system'
    ? `'${safeName}', 'Segoe UI', system-ui, sans-serif`
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
  const count = 300;

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

function createTodoRow(item) {
  const row = document.createElement('div');
  row.className = 'todo no-drag';
  row.dataset.id = item.id;

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

  return row;
}

function render() {
  const active = sortItems(todos.active || []);

  list.innerHTML = '';

  if (!active.length) {
    list.innerHTML = `<div class="empty">${t('nothingLeft')}</div>`;
    previousActiveIds = new Set();
    return;
  }

  for (const item of active) {
    list.appendChild(createTodoRow(item));
  }

  previousActiveIds = new Set(active.map(i => i.id));
}

// 流动排序动画：WAAPI 弹簧流动
function animateSort() {
  const active = todos.active || [];
  if (!active.length) {
    render();
    return;
  }

  const sorted = sortItems(active);
  const rows = [...list.querySelectorAll('.todo')];
  const existingIds = new Set(rows.map(r => r.dataset.id));
  const sortedIds = new Set(sorted.map(i => i.id));

  // First: 捕获已有卡片当前位置
  const firstRects = new Map();
  for (const row of rows) {
    firstRects.set(row.dataset.id, row.getBoundingClientRect());
  }

  // 移除已不在列表中的卡片
  for (const row of rows) {
    if (!sortedIds.has(row.dataset.id)) {
      row.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0 },
        { opacity: 0, transform: 'translateY(-8px) scale(0.96)', offset: 1 }
      ], { duration: 240, easing: 'ease-in', fill: 'forwards' })
        .onfinish = () => row.remove();
    }
  }

  // 新增卡片：插入 DOM
  const newItems = sorted.filter(item => !existingIds.has(item.id));
  for (const item of newItems) {
    list.appendChild(createTodoRow(item));
  }

  // 重排 DOM 到排序后顺序
  const fragment = document.createDocumentFragment();
  for (const item of sorted) {
    const row = list.querySelector(`.todo[data-id="${item.id}"]`);
    if (row) fragment.appendChild(row);
  }
  list.appendChild(fragment);

  // 获取新位置，WAAPI 流动动画
  const springEase = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const sortedRows = [...list.querySelectorAll('.todo')];

  sortedRows.forEach((row, index) => {
    const id = row.dataset.id;
    const isNew = !firstRects.has(id);
    const oldRect = firstRects.get(id);
    const newRect = row.getBoundingClientRect();

    if (isNew) {
      // 新卡片：从下方弹入
      row.animate([
        { opacity: 0, transform: 'translateY(16px) scale(0.96)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }
      ], {
        duration: 360,
        delay: index * 40,
        easing: springEase,
        fill: 'forwards'
      }).onfinish = () => { row.style.opacity = ''; };
    } else if (oldRect) {
      const dy = oldRect.top - newRect.top;
      const dx = oldRect.left - newRect.left;

      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) return;

      // 弹簧流动：从旧位置弹到新位置，带微小过冲
      row.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: `translate(${dx * 0.08}px, ${dy * 0.08}px)` },
        { transform: 'translate(0, 0)' }
      ], {
        duration: 450,
        delay: index * 40,
        easing: springEase,
        fill: 'forwards'
      }).onfinish = () => { row.style.transform = ''; };
    }
  });

  // 更新缓存
  previousActiveIds = new Set(sorted.map(i => i.id));
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
  animateSort(); // 使用液态排序动画
};

widget?.addEventListener('pointermove', updateLiquidSpot);

{
  let dragging = false;
  let startY = 0;
  let startScroll = 0;

  list.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragging = true;
    startY = event.clientY;
    startScroll = list.scrollTop;
    list.setPointerCapture(event.pointerId);
  });

  list.addEventListener('pointermove', event => {
    if (!dragging) return;
    list.scrollTop = Math.max(0, startScroll - (event.clientY - startY));
  });

  list.addEventListener('pointerup', () => { dragging = false; });
  list.addEventListener('pointercancel', () => { dragging = false; });
}

let previousActiveIds = new Set();

window.todoLite.onTodosChanged(data => {
  todos = data;

  const newActiveIds = new Set((data.active || []).map(item => item.id));
  const idsChanged = previousActiveIds.size !== newActiveIds.size ||
    [...newActiveIds].some(id => !previousActiveIds.has(id));

  const sorted = sortItems(data.active || []);
  const rows = list.querySelectorAll('.todo');
  const orderChanged = sorted.some((item, i) => rows[i]?.dataset.id !== item.id);

  if (idsChanged || orderChanged) {
    animateSort();
  }
});

window.todoLite.onSettingsChanged(data => {
  applySettings(data);
  animateSort();
});

function safeFontName(name) {
  return String(name || '').replace(/['\\]/g, '');
}

function injectProjectFonts(list) {
  if (!list.length) return;

  const old = document.getElementById('projectFontsStyle');
  if (old) old.remove();

  const style = document.createElement('style');
  style.id = 'projectFontsStyle';

  style.textContent = list.map(f => {
    const name = safeFontName(f.name);
    return `@font-face{font-family:'${name}';src:url('${f.url}');font-display:swap;}`;
  }).join('\n');

  document.head.appendChild(style);
}

(async function init() {
  const fontData = await window.todoLite.listFonts();
  injectProjectFonts([
    ...(fontData.project || []),
    ...(fontData.system || [])
  ]);

  todos = await window.todoLite.getTodos();
  settings = await window.todoLite.getSettings();

  // 初始化任务 ID 集合
  previousActiveIds = new Set((todos.active || []).map(item => item.id));

  applySettings(settings);
  bindGlowLifecycle(widget);
  render();
})();