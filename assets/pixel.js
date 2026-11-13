/* Pixel da Meta · Solis Viagens */
(function () {
  var PIXEL_ID = '1551995039901447';
  if (window.fbq) return;
  var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
  if (!window._fbq) window._fbq = n;
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  var s = document.createElement('script');
  s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  var miami = /\/miami\/?/.test(location.pathname);
  if (miami) fbq('track', 'ViewContent', { content_name: 'Passagens para Miami', content_category: 'Passagem aérea' });

  document.addEventListener('solis:lead', function () {
    fbq('track', 'Lead', { content_name: miami ? 'Cotação Miami' : 'Orçamento site' });
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-wa]');
    if (a) fbq('track', 'Contact', { content_name: miami ? 'WhatsApp Miami' : 'WhatsApp site' });
  });
})();
