// Solis Viagens · filme de fundo, links do WhatsApp e formulário de orçamento.
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

  /* ---------- Filme de fundo ----------
     O vídeo toca sozinho, no chip de vídeo do aparelho. A rolagem não redesenha nada: só atualiza
     a barra de progresso e o capítulo marcado, no máximo uma vez por quadro. */
  function filmeDeFundo(root) {
    const video = root.querySelector('video');
    const bands = [...root.querySelectorAll('.cap')];
    const botoes = [...root.querySelectorAll('[data-ir]')];
    const barra = root.querySelector('.filme__progresso span');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vertical = matchMedia('(max-width: 860px) and (orientation: portrait)');
    const economia = !!(navigator.connection && navigator.connection.saveData);

    if (video && !reduceMotion && !economia) {
      let naTela = true;
      video.muted = true;
      const tocar = () => {
        if (!naTela || document.hidden) { video.pause(); return; }
        const p = video.play();
        if (p) p.catch(() => {}); // Sem permissão para tocar (modo de economia de bateria): fica a capa.
      };
      const escolher = () => {
        const src = vertical.matches ? video.dataset.m : video.dataset.d;
        if (video.getAttribute('src') === src) return;
        delete video.dataset.tocando;
        video.src = src;
        tocar();
      };
      video.addEventListener('playing', () => { video.dataset.tocando = 'true'; });
      if (vertical.addEventListener) vertical.addEventListener('change', escolher);
      document.addEventListener('visibilitychange', tocar);
      document.addEventListener('touchstart', tocar, { passive: true, once: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { naTela = e.isIntersecting; tocar(); }).observe(root);
      }
      escolher();
    }

    let pontos = [], topo = 0, total = 1, ativo = -1, pedido = 0, largura = innerWidth;
    function medir() {
      const y = scrollY;
      topo = root.getBoundingClientRect().top + y;
      total = Math.max(root.offsetHeight - innerHeight, 1);
      pontos = bands.map(b => { const r = b.getBoundingClientRect(); return { ini: r.top + y, alt: r.height }; });
      atualizar();
    }
    function atualizar() {
      pedido = 0;
      const y = scrollY;
      if (barra) barra.style.transform = `scaleX(${Math.min(1, Math.max(0, (y - topo) / total))})`;
      let i = 0;
      pontos.forEach((p, n) => { if (y >= p.ini - innerHeight * 0.4) i = n; });
      if (i === ativo) return;
      ativo = i;
      botoes.forEach((b, n) => { if (n === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    }
    addEventListener('scroll', () => { if (!pedido) pedido = requestAnimationFrame(atualizar); }, { passive: true });
    // A barra de endereço do celular muda só a altura: nesse caso não há o que medir de novo.
    addEventListener('resize', () => { if (innerWidth !== largura) { largura = innerWidth; medir(); } });
    addEventListener('load', medir);
    botoes.forEach(b => b.addEventListener('click', () => {
      const p = pontos[Number(b.dataset.ir)];
      if (p) scrollTo({ top: p.ini + 0.15 * p.alt, behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
    medir();
  }

  const film = document.getElementById('filme');
  if (film) filmeDeFundo(film);

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
    document.dispatchEvent(new CustomEvent('solis:lead'));
    form.querySelector('.form-note').textContent = 'Abrimos o WhatsApp com a sua mensagem. É só tocar em enviar.';
  });
})();
