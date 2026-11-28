/* Aviso de cookies e Pixel da Meta · Solis Viagens
   O pixel só carrega depois que a pessoa aceita. Recusar ou não responder: nada é carregado. */
(function () {
  var PIXEL_ID = '1551995039901447', CHAVE = 'solis-cookies', VALIDADE = 180 * 864e5;
  var miami = /\/miami\/?/.test(location.pathname);
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

  function carregar() {
    if (ativo) return;
    ativo = true;
    var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    var s = document.createElement('script');
    s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    // Sem coleta automática: só vão os eventos escritos aqui, nunca o conteúdo do formulário.
    fbq('set', 'autoConfig', false, PIXEL_ID);
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    if (miami) fbq('track', 'ViewContent', { content_name: 'Passagens para Miami', content_category: 'Passagem aérea' });
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
    aviso.innerHTML = '<p><b>Cookies de anúncios</b>Usamos o Pixel da Meta para medir nossos anúncios e mostrar a Solis Viagens a quem já visitou o site. Ele só é ativado se você aceitar. <a href="' + (miami ? '../' : '') + 'privacidade.html#cookies">Saiba mais</a></p>' +
      '<div><button type="button" data-ok="0">Recusar</button><button type="button" data-ok="1">Aceitar</button></div>';
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
    if (ativo) fbq('track', 'Lead', { content_name: miami ? 'Cotação Miami' : 'Orçamento site' });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-wa]');
    if (a && ativo) fbq('track', 'Contact', { content_name: miami ? 'WhatsApp Miami' : 'WhatsApp site' });
  });

  var resposta = ler();
  if (resposta === true) carregar();
  else if (resposta === null) abrir(false);
})();
