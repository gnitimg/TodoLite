(() => {
  if (window.__todoLiteMotionPatchInstalled) return;
  window.__todoLiteMotionPatchInstalled = true;

  const state = {
    settings: {},
    todos: { active: [], completed: {}, removed: [] },
    contextMenu: null,
    datePickerDialog: null,
    datePickerTarget: null,
    beforeRects: null,
    currentSurface: null
  };

  const i18n = {
    'zh-CN': {
      taskList: '任务列表',
      edit: '编辑',
      remove: '删除',
      selectTime: '选择时间',
      cancel: '取消',
      save: '保存'
    },
    'en-US': {
      taskList: 'task list',
      edit: 'edit',
      remove: 'delete',
      selectTime: 'select time',
      cancel: 'cancel',
      save: 'save'
    }
  };

  function lang() {
    return state.settings?.global?.language || document.documentElement.lang || 'zh-CN';
  }

  function t(key) {
    return i18n[lang()]?.[key] || i18n['zh-CN'][key] || key;
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

  function itemKeyFromEl(el) {
    if (!el) return '';
    const title = el.querySelector('.content-title, .title')?.textContent?.trim() || '';
    const ddl = el.querySelector('.ddl')?.textContent?.trim() || '';
    const detail = el.querySelector('.detail')?.textContent?.trim() || '';
    return `${title}||${ddl}||${detail}`;
  }

  function allTaskEls() {
    return [...document.querySelectorAll('.todo, .task')];
  }

  function captureLayout() {
    const map = new Map();

    for (const el of allTaskEls()) {
      if (el.classList.contains('particle-removing') || el.classList.contains('done-fade')) continue;

      const key = itemKeyFromEl(el);
      if (!key) continue;

      map.set(key, el.getBoundingClientRect());
    }

    state.beforeRects = map;
  }

  function animateLayout() {
    const before = state.beforeRects;
    if (!before) return;

    requestAnimationFrame(() => {
      for (const el of allTaskEls()) {
        const key = itemKeyFromEl(el);
        const oldRect = before.get(key);
        if (!oldRect) continue;

        const newRect = el.getBoundingClientRect();
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

        el.classList.remove('layout-moving');
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px) scale(.994)`;
        el.style.filter = 'blur(.6px)';

        requestAnimationFrame(() => {
          el.classList.add('layout-moving');
          el.style.transition = '';
          el.style.transform = '';
          el.style.filter = '';

          setTimeout(() => {
            el.classList.remove('layout-moving');
          }, 760);
        });
      }

      state.beforeRects = null;
    });
  }

  function findItemFromEl(el) {
    const title = el.querySelector('.content-title, .title')?.textContent?.trim() || '';
    const ddl = el.querySelector('.ddl')?.textContent?.trim() || '';
    const detail = el.querySelector('.detail')?.textContent?.trim() || '';

    const active = state.todos.active || [];
    const completed = Object.values(state.todos.completed || {}).flat();

    return [...active, ...completed].find(item =>
      String(item.content || '').trim() === title &&
      String(item.ddl || '').trim() === ddl &&
      String(item.detail || '').trim() === detail
    );
  }

  function ensureContextMenu() {
    if (state.contextMenu) return state.contextMenu;

    const menu = document.createElement('div');
    menu.className = 'task-context-menu glass no-drag';
    menu.innerHTML = `
      <button type="button" data-action="edit">${t('edit')}</button>
      <button type="button" data-action="remove" class="danger">${t('remove')}</button>
    `;

    document.body.appendChild(menu);

    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') hideContextMenu();
    });

    state.contextMenu = menu;
    return menu;
  }

  function hideContextMenu() {
    state.contextMenu?.classList.remove('open');
  }

  function showContextMenu(event, el) {
    const item = findItemFromEl(el);
    if (!item) return;

    event.preventDefault();
    event.stopPropagation();

    const menu = ensureContextMenu();

    menu.querySelector('[data-action="edit"]').textContent = t('edit');
    menu.querySelector('[data-action="remove"]').textContent = t('remove');

    menu.querySelector('[data-action="edit"]').onclick = () => {
      hideContextMenu();
      if (typeof window.openEditor === 'function') {
        window.openEditor(item);
      } else if (typeof openEditor === 'function') {
        openEditor(item);
      }
    };

    menu.querySelector('[data-action="remove"]').onclick = () => {
      hideContextMenu();
      removeWithParticles(el, item.id);
    };

    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 140)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - 96)}px`;
    menu.classList.add('open');
  }

  function removeWithParticles(el, id) {
    if (!el || el.classList.contains('particle-removing')) return;

    captureLayout();

    const rect = el.getBoundingClientRect();
    const count = 300;

    el.style.maxHeight = `${rect.height}px`;
    el.classList.add('particle-removing');

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle-dot';

      const x = rect.left + Math.random() * rect.width;
      const y = rect.top + Math.random() * rect.height;
      const dx = (Math.random() - 0.5) * 210;
      const dy = (Math.random() - 0.5) * 150 - 34;

      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty('--dx', `${dx}px`);
      p.style.setProperty('--dy', `${dy}px`);
      p.style.animationDelay = `${Math.random() * 240}ms`;

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }

    setTimeout(async () => {
      captureLayout();
      await window.todoLite.removeTodo(id);
      setTimeout(animateLayout, 60);
    }, 820);
  }

  function installContextMenu() {
    document.addEventListener('contextmenu', event => {
      const el = event.target.closest('.todo, .task');
      if (!el) return;
      showContextMenu(event, el);
    }, true);
  }

  function patchCompletionAnimation() {
    document.addEventListener('click', event => {
      const check = event.target.closest('.check');
      if (!check) return;

      const row = check.closest('.todo, .task');
      if (!row) return;

      captureLayout();

      const rect = row.getBoundingClientRect();
      row.style.maxHeight = `${rect.height}px`;

      setTimeout(() => {
        setTimeout(animateLayout, 90);
      }, 980);
    }, true);
  }

  function ensureDatePicker() {
    if (state.datePickerDialog) return state.datePickerDialog;

    const dialog = document.createElement('dialog');
    dialog.className = 'glass ddl-dialog no-drag';

    dialog.innerHTML = `
      <form method="dialog" class="ddl-form">
        <div class="dialog-title">${t('selectTime')}</div>
        <div class="ddl-grid">
          <input id="ddlYearPatch" inputmode="numeric" maxlength="4" />
          <input id="ddlMonthPatch" inputmode="numeric" maxlength="2" />
          <input id="ddlDayPatch" inputmode="numeric" maxlength="2" />
          <input id="ddlHourPatch" inputmode="numeric" maxlength="2" />
          <input id="ddlMinutePatch" inputmode="numeric" maxlength="2" />
          <input id="ddlSecondPatch" inputmode="numeric" maxlength="2" />
        </div>
        <div class="ddl-labels">
          <span>Y</span><span>M</span><span>D</span><span>H</span><span>M</span><span>S</span>
        </div>
        <div class="dialog-actions">
          <button type="button" id="ddlCancelPatch">${t('cancel')}</button>
          <button type="submit">${t('save')}</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#ddlCancelPatch').onclick = () => dialog.close();

    dialog.querySelector('.ddl-form').onsubmit = event => {
      event.preventDefault();

      const y = dialog.querySelector('#ddlYearPatch').value.padStart(4, '0');
      const mo = dialog.querySelector('#ddlMonthPatch').value.padStart(2, '0');
      const d = dialog.querySelector('#ddlDayPatch').value.padStart(2, '0');
      const h = dialog.querySelector('#ddlHourPatch').value.padStart(2, '0');
      const mi = dialog.querySelector('#ddlMinutePatch').value.padStart(2, '0');
      const s = dialog.querySelector('#ddlSecondPatch').value.padStart(2, '0');

      if (state.datePickerTarget) {
        state.datePickerTarget.value = `${y}-${mo}-${d} ${h}:${mi}:${s}`;
      }

      dialog.close();
    };

    state.datePickerDialog = dialog;
    return dialog;
  }

  function openDatePicker(target) {
    state.datePickerTarget = target;

    const value = target.value || defaultDdl();
    const [date, time] = value.split(' ');
    const [y, mo, d] = (date || '').split('-');
    const [h, mi, s] = (time || '').split(':');

    const dialog = ensureDatePicker();

    dialog.querySelector('#ddlYearPatch').value = y || '';
    dialog.querySelector('#ddlMonthPatch').value = mo || '';
    dialog.querySelector('#ddlDayPatch').value = d || '';
    dialog.querySelector('#ddlHourPatch').value = h || '';
    dialog.querySelector('#ddlMinutePatch').value = mi || '';
    dialog.querySelector('#ddlSecondPatch').value = s || '00';

    dialog.showModal();
  }

  function installDatePicker() {
    const ddl = document.getElementById('ddl');
    if (!ddl) return;

    ddl.classList.add('ddl-picker-input');
    ddl.setAttribute('readonly', 'readonly');
    ddl.setAttribute('placeholder', 'DDL');

    ddl.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openDatePicker(ddl);
    }, true);

    ddl.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        openDatePicker(ddl);
      }
    }, true);

    const addBtn = document.getElementById('addBtn') || document.getElementById('newBtn');

    addBtn?.addEventListener('click', () => {
      setTimeout(() => {
        if (!ddl.value) ddl.value = defaultDdl();
      }, 30);
    }, true);
  }

  function installGlow(surface) {
    if (!surface) return;
    if (surface.dataset.motionGlowInstalled === 'true') return;

    surface.dataset.motionGlowInstalled = 'true';
    state.currentSurface = surface;

    const mk = edge => {
      const s = document.createElement('div');
      s.className = `glow-edge-sensor edge-${edge}`;
      s.dataset.edge = edge;
      surface.appendChild(s);
      return s;
    };

    const sensors = [mk('top'), mk('right'), mk('bottom'), mk('left')];

    let inside = false;
    let lastX = 50;
    let lastY = 0;

    const setSpotPercent = (x, y) => {
      lastX = Math.max(0, Math.min(100, x));
      lastY = Math.max(0, Math.min(100, y));
      surface.style.setProperty('--spot-x', `${lastX}%`);
      surface.style.setProperty('--spot-y', `${lastY}%`);
    };

    const setSpotByPoint = (clientX, clientY) => {
      const rect = surface.getBoundingClientRect();
      setSpotPercent(((clientX - rect.left) / rect.width) * 100, ((clientY - rect.top) / rect.height) * 100);
    };

    const setSpotByEdge = edge => {
      if (edge === 'top') setSpotPercent(lastX, 0);
      else if (edge === 'bottom') setSpotPercent(lastX, 100);
      else if (edge === 'left') setSpotPercent(0, lastY);
      else if (edge === 'right') setSpotPercent(100, lastY);
    };

    const lightOn = event => {
      inside = true;
      if (event?.clientX != null) setSpotByPoint(event.clientX, event.clientY);
      surface.classList.remove('motion-idle', 'is-idle');
      surface.classList.add('motion-lit', 'is-lit');
    };

    const lightOff = edgeOrEvent => {
      inside = false;

      if (typeof edgeOrEvent === 'string') setSpotByEdge(edgeOrEvent);
      else if (edgeOrEvent?.clientX != null) setSpotByPoint(edgeOrEvent.clientX, edgeOrEvent.clientY);

      surface.classList.remove('motion-lit', 'is-lit');
      surface.classList.add('motion-idle', 'is-idle');
    };

    surface.classList.add('motion-idle', 'is-idle');

    surface.addEventListener('mouseenter', lightOn, true);
    surface.addEventListener('pointerenter', lightOn, true);
    surface.addEventListener('mousemove', event => {
      if (!inside) lightOn(event);
      else setSpotByPoint(event.clientX, event.clientY);
    }, true);
    surface.addEventListener('pointermove', event => {
      if (!inside) lightOn(event);
      else setSpotByPoint(event.clientX, event.clientY);
    }, true);
    surface.addEventListener('mouseleave', event => lightOff(event), true);
    surface.addEventListener('pointerleave', event => lightOff(event), true);

    for (const sensor of sensors) {
      sensor.addEventListener('pointerenter', event => {
        lightOn(event);
      }, true);

      sensor.addEventListener('pointerleave', event => {
        const related = event.relatedTarget;
        if (!related || !surface.contains(related)) {
          lightOff(sensor.dataset.edge);
        }
      }, true);
    }

    window.addEventListener('mouseout', event => {
      if (event.relatedTarget === null || event.relatedTarget === undefined) {
        lightOff(event);
      }
    }, true);

    window.addEventListener('blur', () => {
      if (inside) lightOff();
    });
  }

  function patchQuietKey() {
    document.querySelectorAll('[data-i18n="quietList"]').forEach(el => {
      el.dataset.i18n = 'taskList';
      el.textContent = t('taskList');
    });

    document.querySelectorAll('[data-i18n="taskList"]').forEach(el => {
      el.textContent = t('taskList');
    });
  }

  function installTodoLiteMotionPatch() {
    patchQuietKey();

    const surface = document.querySelector('.widget.glass, .panel.glass, .glass');
    installGlow(surface);

    installContextMenu();
    installDatePicker();
    patchCompletionAnimation();

    window.todoLite?.onTodosChanged?.(data => {
      state.todos = data || state.todos;
      requestAnimationFrame(() => {
        patchQuietKey();
        animateLayout();
      });
    });

    window.todoLite?.onSettingsChanged?.(data => {
      state.settings = data || state.settings;
      setTimeout(patchQuietKey, 0);
    });

    window.todoLite?.getTodos?.().then(data => {
      state.todos = data || state.todos;
    });

    window.todoLite?.getSettings?.().then(data => {
      state.settings = data || state.settings;
      patchQuietKey();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installTodoLiteMotionPatch);
  } else {
    installTodoLiteMotionPatch();
  }
})();
