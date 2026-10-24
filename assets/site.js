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
     Cada capítulo tem um trecho do filme. O trecho é baixado como Blob (para a busca de quadro
     funcionar em qualquer servidor) e o tempo do vídeo segue a posição da rolagem. */
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

    const segs = layers.map((layer, i) => ({
      layer, band: bands[i], clip: layer.dataset.clip, mobileClip: layer.dataset.mobileClip,
      start: 0, end: 0, current: 0, target: 0, visible: i === 0,
      loading: false, ready: false, failed: false, source: null, video: null, url: null, abort: null,
    }));
    const sourceFor = s => (isMobile() && s.mobileClip ? s.mobileClip : s.clip);

    let rootTop = 0, total = 1, vh = innerHeight, lastWidth = innerWidth, dirty = true, active = -1, userReady = false;

    function unload(s) {
      if (s.abort) s.abort.abort();
      if (s.video) s.video.remove();
      if (s.url) URL.revokeObjectURL(s.url);
      Object.assign(s, { abort: null, video: null, url: null, source: null, loading: false, ready: false, failed: false });
      delete s.layer.dataset.pintado;
    }

    function layout() {
      const y = scrollY;
      rootTop = root.getBoundingClientRect().top + y;
      vh = innerHeight;
      lastWidth = innerWidth;
      for (const s of segs) {
        if (s.source && s.source !== sourceFor(s)) unload(s);
        const r = s.band.getBoundingClientRect();
        s.start = r.top + y - rootTop;
        s.end = s.start + r.height;
      }
      total = Math.max(segs[segs.length - 1].end, vh);
      dirty = true;
    }

    async function prime(video) {
      if (!video || !isMobile()) return;
      try { await video.play(); video.pause(); } catch (e) { /* fica no pôster */ }
    }

    async function load(s) {
      const src = sourceFor(s);
      if (reduceMotion || s.loading || s.ready || s.failed || !src) return;
      s.loading = true; s.source = src; s.abort = new AbortController();
      const req = s.abort;
      try {
        const res = await fetch(src, { signal: req.signal });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (req.signal.aborted || s.source !== src) return;
        const url = URL.createObjectURL(blob);
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.src = url;
        v.addEventListener('loadedmetadata', () => { if (s.video === v) { s.ready = true; s.loading = false; dirty = true; } }, { once: true });
        v.addEventListener('loadeddata', () => { if (userReady && s.video === v) prime(v); }, { once: true });
        v.addEventListener('seeked', () => { if (s.video === v) s.layer.dataset.pintado = 'true'; }, { once: true });
        v.addEventListener('error', () => {
          if (s.video !== v) return;
          v.remove(); URL.revokeObjectURL(url);
          Object.assign(s, { video: null, url: null, failed: true, loading: false, ready: false });
          delete s.layer.dataset.pintado;
        }, { once: true });
        s.layer.append(v);
        s.video = v; s.url = url;
      } catch (e) {
        if (req.signal.aborted || s.source !== src) return;
        s.failed = true; s.loading = false;
      }
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

    function updateVideos() {
      const eps = isMobile() ? 0.02 : 0.008;
      for (const s of segs) {
        const v = s.video;
        if (!v || !s.ready || v.seeking) continue;
        if (!s.visible && Math.abs(s.current - s.target) < 0.002) continue;
        s.current += (s.target - s.current) * 0.2;
        const t = clamp(s.current, 0, 0.999) * (v.duration || 1);
        if (Math.abs(v.currentTime - t) > eps) { try { v.currentTime = t; } catch (e) { /* mantém o último quadro */ } }
      }
    }

    function tick() {
      if (dirty) { dirty = false; readScroll(); }
      updateVideos();
      requestAnimationFrame(tick);
    }

    addEventListener('scroll', () => { dirty = true; }, { passive: true });
    addEventListener('resize', () => { if (coarse && innerWidth === lastWidth) return; layout(); });
    addEventListener('orientationchange', layout);
    addEventListener('load', layout);
    const firstGesture = () => { if (userReady) return; userReady = true; segs.forEach(s => prime(s.video)); };
    addEventListener('pointerdown', firstGesture, { once: true, passive: true });
    addEventListener('touchstart', firstGesture, { once: true, passive: true });

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

  // Menu com fundo sólido quando o filme termina (ou em páginas sem filme).
  const topo = document.querySelector('.topo');
  if (topo) {
    const solid = () => topo.classList.toggle('topo--solido', !film || film.getBoundingClientRect().bottom < 80);
    addEventListener('scroll', solid, { passive: true });
    solid();
  }

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
