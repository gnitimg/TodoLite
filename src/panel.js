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

const accentDialog = document.getElementById('accentDialog');
const accentForm = document.getElementById('accentForm');
const accentTrigger = document.getElementById('accentTrigger');
const accentPicker = document.getElementById('accentPicker');
const accentDot = document.getElementById('accentDot');
const accentText = document.getElementById('accentText');
const accentPresets = document.getElementById('accentPresets');
const accentWheel = document.getElementById('accentWheel');
const accentThumb = document.getElementById('accentThumb');
const accentPreview = document.getElementById('accentPreview');
const accentHexInput = document.getElementById('accentHexInput');
const accentDialogDot = document.getElementById('accentDialogDot');

let pendingAccentColor = '#5f8cff';

const startupToggle = document.getElementById('startupToggle');
const startupText = document.getElementById('startupText');
let contextMenu = null;
let datePickerDialog = null;
let datePickerTarget = null;

const accentPresetValues = [
  '#5f8cff',
  '#8b5cf6',
  '#06b6d4',
  '#22c55e',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#111827'
];

const i18n = {
  'zh-CN': {
    tasks: '任务',
    settings: '设置',
    active: '未完成',
    completedByDate: '按完成日期记录',
    nothingActive: '没有未完成任务',
    noCompleted: '没有完成记录',
    global: '全局',
    widget: '小窗口',
    panel: '主面板',
    font: '字体',
    fontSize: '字号',
    language: '语言',
    accentColor: '主题色',
    startup: '开机启动',
    on: '开启',
    off: '关闭',
    opacity: '透明度',
    blur: '雾化',
    radius: '圆角',
    layer: '小窗口层级',
    openData: '打开数据',
    openBackups: '打开备份',
    remove: '移除',
    cancel: '取消',
    save: '保存',
    content: '内容',
    detail: '详情，可选',
    search: '搜索...',
    noMatch: '没有匹配',
    putFonts: '将 .ttf / .otf / .woff 放入 fonts 文件夹',
    edit: '编辑',
    selectTime: '选择时间',
    about: '关于',
    version: '版本',
    license: '开源协议',
    sourceCode: '源代码',
    reportIssue: '问题反馈'
  },
  'en-US': {
    tasks: 'Tasks',
    settings: 'Settings',
    subtitle: 'visible, exact, retained',
    settingsSubtitle: 'global first, then surfaces',
    active: 'active',
    completedByDate: 'completed by date',
    nothingActive: 'nothing active',
    noCompleted: 'no completed record',
    global: 'Global',
    widget: 'Widget',
    panel: 'Panel',
    font: 'Font',
    fontSize: 'Font size',
    language: 'Language',
    accentColor: 'Accent color',
    startup: 'Launch at startup',
    on: 'On',
    off: 'Off',
    opacity: 'Opacity',
    blur: 'Haze',
    radius: 'Radius',
    layer: 'Widget layer',
    openData: 'open data',
    openBackups: 'open backups',
    remove: 'remove',
    cancel: 'cancel',
    save: 'save',
    content: 'content',
    detail: 'detail, optional',
    search: 'search...',
    noMatch: 'no match',
    putFonts: 'put .ttf / .otf / .woff in fonts',
    edit: 'edit',
    selectTime: 'select time',
    about: 'About',
    version: 'Version',
    license: 'License',
    sourceCode: 'Source code',
    reportIssue: 'Report issue'
  }
};

const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' }
];

const widgetLayerOptions = [
  { value: 'desktop', label: 'desktop' },
  { value: 'normal', label: 'normal' },
  { value: 'topmost', label: 'topmost' }
];

function t(key) {
  const lang = settings.global?.language || 'zh-CN';
  return i18n[lang]?.[key] || i18n['zh-CN'][key] || key;
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

function normalizeHex(value) {
  const raw = String(value || '').trim();

  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }

  return '#5f8cff';
}

function hslToHex(h, s = 88, l = 62) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp >= 1 && hp < 2) [r, g, b] = [x, c, 0];
  else if (hp >= 2 && hp < 3) [r, g, b] = [0, c, x];
  else if (hp >= 3 && hp < 4) [r, g, b] = [0, x, c];
  else if (hp >= 4 && hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = l - c / 2;

  const toHex = n => Math.round((n + m) * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHue(hex) {
  const { r, g, b } = hexToRgb(normalizeHex(hex));

  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  if (d === 0) return 220;

  let h;

  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return Math.round((h * 60 + 360) % 360);
}

function syncAccentDialog(color) {
  const normalized = normalizeHex(color);

  pendingAccentColor = normalized;

  if (accentPicker) accentPicker.value = normalized;
  if (accentDot) accentDot.style.background = normalized;
  if (accentText) accentText.textContent = normalized;
  if (accentPreview) accentPreview.style.background = normalized;
  if (accentDialogDot) accentDialogDot.style.background = normalized;
  if (accentHexInput && accentHexInput.value !== normalized) accentHexInput.value = normalized;

  const { r, g, b } = hexToRgb(normalized);
  document.documentElement.style.setProperty('--accent', normalized);
  document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);

  if (!accentThumb || !accentWheel) return;

  const hue = hexToHue(normalized);
  const angle = (hue - 90) * Math.PI / 180;
  const radius = 82;

  accentThumb.style.left = `${110 + Math.cos(angle) * radius}px`;
  accentThumb.style.top = `${110 + Math.sin(angle) * radius}px`;
  accentThumb.style.background = normalized;
}

function pickAccentFromPoint(clientX, clientY) {
  if (!accentWheel) return;

  const rect = accentWheel.getBoundingClientRect();

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const dx = clientX - cx;
  const dy = clientY - cy;

  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 46 || distance > 120) return;

  const angle = Math.atan2(dy, dx);
  const hue = Math.round((angle * 180 / Math.PI + 90 + 360) % 360);

  syncAccentDialog(hslToHex(hue));
}

function setSurfaceVars(target, surface, global) {
  const opacity = clamp01(surface.glassOpacity ?? .2);
  const blur = clamp100(surface.blurStrength ?? 18);
  const radius = Number(surface.cornerRadius ?? 22);
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

  applyGlobalSettings(settings.global || {});
  setSurfaceVars(panel, settings.panel || {}, settings.global || {});
  syncSettingsUI();
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  content.placeholder = t('content');
  detail.placeholder = t('detail');

  const search = document.getElementById('globalFontSearch');
  if (search) search.placeholder = t('search');
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
  updateWidgetLayerSelected();
  updateAccentSelected();
  updateStartupSelected();
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

function updateWidgetLayerSelected() {
  const value = settings.widget?.layer || 'desktop';
  const option = widgetLayerOptions.find(item => item.value === value) || widgetLayerOptions[0];
  document.getElementById('windowLevelSelected').textContent = option.label;
}

function updateAccentSelected() {
  const color = normalizeHex(settings.global?.accentColor || '#5f8cff');
  syncAccentDialog(color);
}

function updateStartupSelected() {
  if (!startupToggle || !startupText) return;

  const enabled = Boolean(settings.global?.startup);

  startupToggle.classList.toggle('active', enabled);
  startupToggle.setAttribute('aria-pressed', String(enabled));
  startupText.textContent = enabled ? t('on') : t('off');
}

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
  const projectFonts = fonts.project || [];
  const systemFonts = fonts.system || [];

  const projectFiltered = projectFonts.filter(font => !f || font.name.toLowerCase().includes(f));
  const systemFiltered = systemFonts.filter(font => !f || font.name.toLowerCase().includes(f));
  const currentFont = (settings.global || {}).fontFamily || 'system';

  function addOption(font) {
    const opt = document.createElement('button');
    const safeName = safeFontName(font.name);

    opt.type = 'button';
    opt.className = 'liquid-option' + (font.name === currentFont ? ' active' : '');
    opt.textContent = font.name;
    opt.style.fontFamily = font.name !== 'system' ? `'${safeName}', sans-serif` : '';

    opt.onclick = async () => {
      const safeName = safeFontName(font.name);
      const selected = document.getElementById('globalFontSelected');

      if (selected) {
        selected.textContent = font.name;
        selected.style.fontFamily = font.name !== 'system' ? `'${safeName}', sans-serif` : '';
      }

      const immediateFamily = font.name !== 'system'
        ? `'${safeName}', 'Segoe UI', system-ui, sans-serif`
        : `Inter, 'Segoe UI', system-ui, sans-serif`;

      document.documentElement.style.setProperty('--font-family', immediateFamily);
      document.body.style.fontFamily = immediateFamily;

      document.getElementById('globalFontDropdown').classList.remove('open');
      document.getElementById('globalFontSearch').value = '';

      const next = await window.todoLite.updateSettings({
        global: {
          fontFamily: font.name
        }
      });

      applySettings(next);
    };

    list.appendChild(opt);
  }

  addOption({ name: 'system' });

  if (projectFiltered.length) {
    const sep = document.createElement('div');
    sep.className = 'liquid-sep';
    sep.textContent = 'project fonts';
    list.appendChild(sep);

    projectFiltered.forEach(addOption);
  }

  if (systemFiltered.length) {
    const sep = document.createElement('div');
    sep.className = 'liquid-sep';
    sep.textContent = 'windows fonts';
    list.appendChild(sep);

    systemFiltered.slice(0, 2000).forEach(addOption);
  }

  if (!projectFiltered.length && !systemFiltered.length && f) {
    const empty = document.createElement('div');
    empty.className = 'liquid-empty';
    empty.textContent = t('noMatch');
    list.appendChild(empty);
  }

  if (!projectFiltered.length && !systemFiltered.length && !f) {
    const empty = document.createElement('div');
    empty.className = 'liquid-empty';
    empty.textContent = t('putFonts');
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
  row.className = `task no-drag ${done ? 'done' : ''}`;

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

  row.oncontextmenu = event => showContextMenu(event, item, row);

  return row;
}

function render() {
  const active = [...(todos.active || [])].sort((a, b) => String(a.ddl).localeCompare(String(b.ddl)));

  activeList.innerHTML = `<div class="section-title">${t('active')}</div>`;

  if (!active.length) {
    activeList.innerHTML += `<div class="empty">${t('nothingActive')}</div>`;
  } else {
    active.forEach(item => activeList.appendChild(makeTask(item, false)));
  }

  completedList.innerHTML = `<div class="section-title">${t('completedByDate')}</div>`;

  const keys = Object.keys(todos.completed || {}).sort().reverse();

  if (!keys.length) {
    completedList.innerHTML += `<div class="empty">${t('noCompleted')}</div>`;
  }

  for (const key of keys) {
    const card = document.createElement('div');
    card.className = 'date-card no-drag';

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
  ddl.value = item?.ddl || defaultDdl();
  detail.value = item?.detail || '';

  deleteBtn.style.visibility = editingId ? 'visible' : 'hidden';

  editor.showModal();
  content.focus();
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
  const count = 22;

  row.classList.add('particle-removing');

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle-dot';

    const x = rect.left + Math.random() * rect.width;
    const y = rect.top + Math.random() * rect.height;
    const dx = (Math.random() - 0.5) * 140;
    const dy = (Math.random() - 0.5) * 90 - 24;

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    p.style.animationDelay = `${Math.random() * 100}ms`;

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 820);
  }

  setTimeout(async () => {
    await window.todoLite.removeTodo(id);
  }, 560);
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

function initAccentPicker() {
  if (!accentTrigger || !accentDialog || !accentForm) return;

  accentPresets.innerHTML = '';

  for (const color of accentPresetValues) {
    const btn = document.createElement('button');

    btn.type = 'button';
    btn.className = 'accent-preset';
    btn.style.background = color;

    btn.onclick = event => {
      event.preventDefault();
      syncAccentDialog(color);
    };

    accentPresets.appendChild(btn);
  }

  let wheelDragging = false;

  accentWheel?.addEventListener('pointerdown', event => {
    wheelDragging = true;
    accentWheel.setPointerCapture?.(event.pointerId);
    pickAccentFromPoint(event.clientX, event.clientY);
  });

  accentWheel?.addEventListener('pointermove', event => {
    if (!wheelDragging) return;
    pickAccentFromPoint(event.clientX, event.clientY);
  });

  accentWheel?.addEventListener('pointerup', event => {
    wheelDragging = false;
    accentWheel.releasePointerCapture?.(event.pointerId);
  });

  accentHexInput?.addEventListener('input', () => {
    const value = accentHexInput.value.trim();

    if (/^#[0-9a-fA-F]{6}$/.test(value) || /^#[0-9a-fA-F]{3}$/.test(value)) {
      syncAccentDialog(value);
    }
  });

  accentTrigger.onclick = () => {
    syncAccentDialog(settings.global?.accentColor || '#5f8cff');
    accentDialog.showModal();
  };

  document.getElementById('accentCancel').onclick = () => {
    accentDialog.close();
  };

  accentForm.onsubmit = async event => {
    event.preventDefault();

    const next = await window.todoLite.updateSettings({
      global: {
        accentColor: pendingAccentColor
      }
    });

    applySettings(next);
    accentDialog.close();
  };
}

function initStartupToggle() {
  if (!startupToggle) return;

  startupToggle.onclick = async () => {
    const current = Boolean(settings.global?.startup);

    const next = await window.todoLite.updateSettings({
      global: {
        startup: !current
      }
    });

    applySettings(next);
  };
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
ddl.onclick = () => openDatePicker(ddl);
ddl.onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openDatePicker(ddl);
  }
};
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
    document.getElementById('aboutPage').classList.toggle('hidden', btn.dataset.page !== 'about');
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

  if (!el) continue;

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
  render();
});

window.todoLite.onPanelFullscreenChanged(isFull => {
  setFullscreenIconState(isFull);
});

(async function init() {
  fonts = await window.todoLite.listFonts();
  injectProjectFonts([
    ...(fonts.project || []),
    ...(fonts.system || [])
  ]);

  todos = await window.todoLite.getTodos();
  settings = await window.todoLite.getSettings();

  applySettings(settings);
  initFontDropdown();
  initAccentPicker();
  initStartupToggle();
  bindGlowLifecycle(panel);

  const ver = await window.todoLite.getVersion();
  const verEl = document.getElementById('aboutVersion');
  if (verEl) verEl.textContent = `v${ver}`;

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
      render();
    }
  });

  initLiquidSelect({
    rootId: 'windowLevelDropdown',
    triggerId: 'windowLevelSelected',
    listId: 'windowLevelList',
    options: widgetLayerOptions,
    getValue: () => settings.widget?.layer || 'desktop',
    onChange: async value => {
      const next = await window.todoLite.updateSettings({
        widget: {
          layer: value
        }
      });
      applySettings(next);
    }
  });

  render();

  const isFull = await window.todoLite.getPanelFullscreenState();
  setFullscreenIconState(isFull);
})();