// Solis Viagens · filme controlado pela rolagem, links do WhatsApp e formulário de orçamento.
// O número do WhatsApp fica no atributo data-whatsapp do <body> (só dígitos, com 55 e DDD).
(function () {
  const body = document.body;
  const phone = (body.dataset.whatsapp || '').replace(/\D/g, '');
  const DEFAULT_TEXT = 'Olá! Vim pelo site da Solis Viagens e quero um orçamento.';
  const waUrl = text => `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  document.querySelectorAll('[data-wa]').forEach(a => {
    a.href = waUrl(a.dataset.waText || DEFAULT_TEXT);
    a.target = '_blank';
    a.rel = 'noopener';
  });
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  /* ---------- Filme rolado ----------
     Cada capítulo tem um trecho do filme em quadros WebP: d = computador (12 por segundo, com
     mistura entre vizinhos), m = celular vertical (24 por segundo, um desenho por quadro).
     Cada quadro é decodificado antes de entrar no filme, para nada ser decodificado durante a rolagem. */
  function scrollFilm(root) {
    const layers = [...root.querySelectorAll('.filme__camada')];
    const bands = [...root.querySelectorAll('.cap')];
    const routeButtons = [...root.querySelectorAll('[data-ir]')];
    if (!layers.length || layers.length !== bands.length) return;

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
    const small = matchMedia('(max-width: 860px)');
    const isMobile = () => coarse || small.matches;
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const smooth = v => { const x = clamp(v); return x * x * (3 - 2 * x); };
    const lerp = () => (isMobile() ? 0.2 : 0.14);

    const segs = layers.map((layer, i) => {
      const canvas = document.createElement('canvas');
      layer.append(canvas);
      return {
        layer, band: bands[i], canvas, ctx: canvas.getContext('2d', { alpha: false }),
        dir: layer.dataset.frames, counts: { d: Number(layer.dataset.countD) || 0, m: Number(layer.dataset.countM) || 0 },
        count: 0, start: 0, end: 0, current: 0, target: 0, visible: i === 0,
        kind: null, images: [], loaded: null, loading: false, drawn: -1,
      };
    });
    const kindNow = () => (isMobile() ? 'm' : 'd');
    const frameUrl = (s, k, n) => `${s.dir}/${k}-${String(n + 1).padStart(3, '0')}.webp`;

    let rootTop = 0, total = 1, vh = innerHeight, lastWidth = innerWidth, dirty = true, active = -1;

    // Solta os quadros de trechos longe da tela para não estourar a memória do celular.
    function unload(s) {
      s.images = []; s.loaded = null; s.kind = null; s.loading = false; s.drawn = -1;
      delete s.layer.dataset.pintado;
    }

    // Os quadros do celular têm 432 px de largura: um canvas maior só gastaria bateria sem ganhar nitidez.
    function sizeCanvas(s) {
      const dpr = Math.min(devicePixelRatio || 1, 1.25);
      const w = Math.round(s.layer.clientWidth * dpr), h = Math.round(s.layer.clientHeight * dpr);
      if (s.canvas.width !== w || s.canvas.height !== h) { s.canvas.width = w; s.canvas.height = h; s.drawn = -1; }
    }

    function layout() {
      const y = scrollY;
      rootTop = root.getBoundingClientRect().top + y;
      vh = innerHeight;
      lastWidth = innerWidth;
      for (const s of segs) {
        if (s.kind && s.kind !== kindNow()) unload(s);
        sizeCanvas(s);
        const r = s.band.getBoundingClientRect();
        s.start = r.top + y - rootTop;
        s.end = s.start + r.height;
      }
      total = Math.max(segs[segs.length - 1].end, vh);
      dirty = true;
    }

    function loadFrame(s, k, n) {
      return new Promise(resolve => {
        const img = new Image();
        img.decoding = 'async';
        img.src = frameUrl(s, k, n);
        img.decode()
          .then(() => { if (s.kind === k) { s.images[n] = img; s.loaded[n] = 1; } })
          .catch(() => {})
          .finally(resolve);
      });
    }

    // Baixa primeiro o quadro onde a rolagem está e depois os vizinhos, em lotes.
    async function load(s) {
      const k = kindNow();
      if (reduceMotion || s.loading || s.kind || !s.counts[k]) return;
      s.count = s.counts[k];
      s.kind = k; s.loading = true; s.images = new Array(s.count); s.loaded = new Uint8Array(s.count);
      const from = Math.round(s.target * (s.count - 1));
      const order = [...Array(s.count).keys()].sort((a, b) => Math.abs(a - from) - Math.abs(b - from));
      for (let i = 0; i < order.length; i += 6) {
        if (s.kind !== k) return;
        await Promise.all(order.slice(i, i + 6).map(n => loadFrame(s, k, n)));
        s.drawn = -1;
      }
      if (s.kind === k) s.loading = false;
    }

    function nearest(s, n) {
      if (s.loaded[n]) return n;
      for (let d = 1; d < s.count; d++) {
        if (n - d >= 0 && s.loaded[n - d]) return n - d;
        if (n + d < s.count && s.loaded[n + d]) return n + d;
      }
      return -1;
    }

    function cover(s, img, alpha) {
      const cw = s.canvas.width, ch = s.canvas.height;
      const k = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      s.ctx.globalAlpha = alpha;
      s.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    // Computador: desenha o quadro e mistura o seguinte pela fração. Celular: um quadro por desenho,
    // que com 24 por segundo já corre liso e custa metade.
    function draw(s) {
      if (!s.loaded || !s.count) return;
      const pos = clamp(s.current) * (s.count - 1);
      const blend = s.kind === 'd';
      const key = blend ? Math.round(pos * 8) : Math.round(pos);
      if (key === s.drawn) return;
      const a = nearest(s, blend ? Math.floor(pos) : Math.round(pos));
      if (a < 0) return;
      const b = Math.min(a + 1, s.count - 1);
      const frac = blend && a === Math.floor(pos) && s.loaded[b] ? pos - a : 0;
      cover(s, s.images[a], 1);
      if (frac > 0.02 && b !== a) cover(s, s.images[b], frac);
      s.ctx.globalAlpha = 1;
      s.drawn = key;
      s.layer.dataset.pintado = 'true';
    }

    function readScroll() {
      const y = clamp(scrollY - rootTop, 0, total);
      const fade = 0.1 * vh;
      let cur = 0;
      segs.forEach((s, i) => {
        if (y >= s.start) cur = i;
        s.target = clamp((y - s.start) / Math.max(s.end - s.start, 1));
        const outside = y < s.start ? s.start - y : y > s.end ? y - s.end : 0;
        let op = smooth(1 - outside / Math.max(fade, 1));
        if (reduceMotion) op = outside === 0 ? 1 : 0;
        s.visible = op > 0.001;
        s.layer.style.opacity = String(op);
        s.layer.style.zIndex = i === cur ? '2' : '1';
        if (y > s.start - 1.5 * vh && y < s.end + 1.5 * vh) load(s);
        else if (y < s.start - 2.5 * vh || y > s.end + 2.5 * vh) { if (s.kind) unload(s); }
      });
      if (cur !== active) {
        active = cur;
        routeButtons.forEach((b, i) => {
          if (i === active) b.setAttribute('aria-current', 'step');
          else b.removeAttribute('aria-current');
        });
      }
      root.style.setProperty('--progresso', String(clamp(y / total)));
    }

    function updateFrames() {
      for (const s of segs) {
        if (!s.visible) { s.current = s.target; continue; }
        const d = s.target - s.current;
        s.current = Math.abs(d) < 0.0005 ? s.target : s.current + d * lerp();
        draw(s);
      }
    }

    function tick() {
      if (dirty) { dirty = false; readScroll(); }
      updateFrames();
      requestAnimationFrame(tick);
    }

    addEventListener('scroll', () => { dirty = true; }, { passive: true });
    addEventListener('resize', () => { if (coarse && innerWidth === lastWidth) return; layout(); });
    addEventListener('orientationchange', layout);
    addEventListener('load', layout);

    routeButtons.forEach(b => b.addEventListener('click', () => {
      const s = segs[Number(b.dataset.ir)];
      if (!s) return;
      scrollTo({ top: rootTop + s.start + 0.15 * (s.end - s.start), behavior: reduceMotion ? 'auto' : 'smooth' });
    }));

    layout();
    requestAnimationFrame(tick);
  }

  const film = document.getElementById('filme');
  if (film) scrollFilm(film);

  // Menu com fundo sólido quando o filme ou a capa terminam (ou em páginas sem nenhum dos dois).
  const topo = document.querySelector('.topo');
  const capa = film || document.querySelector('[data-hero]');
  if (topo) {
    const solid = () => topo.classList.toggle('topo--solido', !capa || capa.getBoundingClientRect().bottom < 80);
    addEventListener('scroll', solid, { passive: true });
    solid();
  }

  // Prazo de oferta: durante o período mostra quanto falta; depois do fim troca pelo aviso de encerrada.
  document.querySelectorAll('[data-ate]').forEach(el => {
    const de = Date.parse(el.dataset.de || ''), ate = Date.parse(el.dataset.ate);
    const tick = () => {
      const now = Date.now();
      if (now > ate) { el.textContent = el.dataset.txtFim || ''; return; }
      if (de && now < de) return;
      const min = Math.floor((ate - now) / 60000);
      const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60);
      el.textContent = d > 0 ? `Faltam ${d} ${d === 1 ? 'dia' : 'dias'} e ${h}h para o fim da oferta` : `Últimas ${h}h ${min % 60}min de oferta`;
      setTimeout(tick, 30000);
    };
    tick();
  });

  /* ---------- Formulário → mensagem no WhatsApp. Nada é gravado pelo site. ---------- */
  const form = document.getElementById('lead-form');
  if (!form) return;

  const today = new Date().toISOString().slice(0, 10);
  form.querySelectorAll('input[type="date"]').forEach(d => { d.min = today; });

  function setError(field, msg) {
    const wrap = field.closest('.campo');
    const err = wrap && wrap.querySelector('.err');
    if (err) err.textContent = msg || '';
    if (field.type !== 'radio') field.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function validate() {
    let first = null;
    const seen = new Set();
    form.querySelectorAll('[required]').forEach(el => {
      if (el.type === 'radio') { if (seen.has(el.name)) return; seen.add(el.name); }
      let msg = '';
      if (el.type === 'checkbox') msg = el.checked ? '' : 'Marque para continuar.';
      else if (el.type === 'radio') msg = form.querySelector(`[name="${el.name}"]:checked`) ? '' : 'Escolha uma opção.';
      else if (!el.value.trim()) msg = 'Preencha este campo.';
      else if (el.type === 'tel' && el.value.replace(/\D/g, '').length < 10) msg = 'Informe o número com DDD.';
      setError(el, msg);
      if (msg && !first) first = el;
    });
    const ida = form.elements.ida, volta = form.elements.volta;
    setError(ida, ''); setError(volta, '');
    if (ida.value && ida.value < today) { setError(ida, 'Escolha uma data a partir de hoje.'); first = first || ida; }
    if (ida.value && volta.value && volta.value < ida.value) { setError(volta, 'A volta precisa ser depois da ida.'); first = first || volta; }
    if (first) first.focus();
    return !first;
  }

  form.querySelectorAll('input').forEach(el => el.addEventListener('input', () => setError(el, '')));
  form.querySelectorAll('input[type="radio"]').forEach(el => el.addEventListener('change', () => setError(el, '')));

  const fmtDate = v => (v ? v.split('-').reverse().join('/') : '');

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validate()) return;
    const lines = [DEFAULT_TEXT];
    form.querySelectorAll('[data-label]').forEach(el => {
      let v = '';
      if (el.type === 'radio') { if (!el.checked) return; v = el.value; }
      else if (el.type === 'date') v = fmtDate(el.value);
      else v = el.value.trim();
      if (v) lines.push(`${el.dataset.label}: ${v}`);
    });
    window.open(waUrl(lines.join('\n')), '_blank', 'noopener');
    form.querySelector('.form-note').textContent = 'Abrimos o WhatsApp com a sua mensagem. É só tocar em enviar.';
  });
})();
