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

function setSurfaceVars(target, surface, global, defaults) {
  const d = defaults || {};
  const opacity = clamp01(surface.glassOpacity ?? d.glassOpacity ?? .14);
  const blur = clamp100(surface.blurStrength ?? d.blurStrength ?? 36);
  const radius = Number(surface.cornerRadius ?? d.cornerRadius ?? 24);
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
