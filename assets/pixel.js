/* Pixel da Meta · Solis Viagens
   O pixel liga sozinho em toda visita, sem aviso na tela. Quem quiser desligar usa
   "Preferências de cookies" no rodapé; a escolha fica guardada no navegador. */
(function () {
  var PIXEL_ID = '1551995039901447', CHAVE = 'solis-cookies', VALIDADE = 180 * 864e5;
  var miami = /\/miami\/?/.test(location.pathname);
  var destino = document.body.dataset.destino || '';
  var origem = miami ? 'Miami' : destino || 'site';
  var ativo = false, aviso = null, voltarFoco = null;

  function ler() {
    try {
      var d = JSON.parse(localStorage.getItem(CHAVE));
      return d && Date.now() - d.em < VALIDADE ? d.ok : null;
    } catch (e) { return null; }
  }
  function gravar(ok) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ ok: ok, em: Date.now() })); } catch (e) {}
  }

  // O script da Meta (~200 KB) só é baixado depois que a página terminou de abrir e o
  // navegador ficou livre, ou antes disso na primeira interação. Até lá os eventos ficam
  // na fila do fbq e são enviados assim que o script chega.
  var injetado = false;
  function injetar() {
    if (injetado) return;
    injetado = true;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  function injetarDepois() {
    var ocioso = window.requestIdleCallback || function (f) { return setTimeout(f, 1500); };
    var agendar = function () { ocioso(injetar, { timeout: 3000 }); };
    if (document.readyState === 'complete') agendar();
    else window.addEventListener('load', agendar, { once: true });
    ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, injetar, { once: true, passive: true });
    });
  }

  function carregar() {
    if (ativo) return;
    ativo = true;
    var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    injetarDepois();
    // Sem coleta automática: só vão os eventos escritos aqui, nunca o conteúdo do formulário.
    fbq('set', 'autoConfig', false, PIXEL_ID);
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    if (miami) fbq('track', 'ViewContent', { content_name: 'Passagens para Miami', content_category: 'Passagem aérea' });
    else if (destino) fbq('track', 'ViewContent', { content_name: destino, content_category: 'Destino' });
  }

  function apagarCookies() {
    var dominio = location.hostname.replace(/^www\./, '');
    ['_fbp', '_fbc'].forEach(function (c) {
      var fim = c + '=; Max-Age=0; path=/';
      document.cookie = fim;
      document.cookie = fim + '; domain=.' + dominio;
    });
  }

  function responder(ok) {
    gravar(ok);
    fechar();
    if (ok) { carregar(); return; }
    apagarCookies();
    if (ativo) location.reload(); // Já estava carregado: recarrega a página sem o pixel.
  }

  function fechar() {
    if (aviso) aviso.remove();
    aviso = null;
    document.body.classList.remove('com-aviso');
    if (voltarFoco) voltarFoco.focus();
    voltarFoco = null;
  }

  function abrir(pelaPessoa) {
    if (aviso) return;
    aviso = document.createElement('section');
    aviso.className = 'aviso-cookies';
    aviso.setAttribute('aria-label', 'Aviso de cookies');
    aviso.innerHTML = '<p><b>Cookies de anúncios</b>Usamos o Pixel da Meta para medir nossos anúncios e mostrar a Solis Viagens a quem já visitou o site. Você pode desativar quando quiser. <a href="' + (miami || destino ? '../' : '') + 'privacidade.html#cookies">Saiba mais</a></p>' +
      '<div><button type="button" data-ok="0">Desativar</button><button type="button" data-ok="1">Manter ativado</button></div>';
    aviso.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) responder(b.dataset.ok === '1');
    });
    if (pelaPessoa) voltarFoco = document.activeElement;
    document.body.appendChild(aviso);
    document.body.classList.add('com-aviso');
    document.body.style.setProperty('--aviso', aviso.offsetHeight + 'px');
    if (pelaPessoa) aviso.querySelector('button').focus();
  }

  document.querySelectorAll('[data-cookies]').forEach(function (b) {
    b.addEventListener('click', function () { abrir(true); });
  });
  document.addEventListener('solis:lead', function () {
    if (ativo) fbq('track', 'Lead', { content_name: 'Orçamento ' + origem });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-wa]');
    if (a && ativo) fbq('track', 'Contact', { content_name: 'WhatsApp ' + origem });
  });

  if (ler() !== false) carregar();
})();
