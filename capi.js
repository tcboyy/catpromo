/* ====================================================================
   Ponte pra Conversions API — CAT TECH PROMO
   ====================================================================

   Carregado por TODAS as paginas do site, logo depois do fbq('init').
   Um arquivo so: a URL do Worker muda em UM lugar e vale pro site inteiro.

     pagina ──fbq(evento, {eventID})──────────────▶ Meta  (pixel · navegador)
        │
        └──POST /e {evento, event_id, ...}──▶ Worker ──▶ Meta  (CAPI · servidor)

   O MESMO event_id vai pelos dois caminhos. A Meta deduplica e fica com o
   que chegar primeiro. Sem isso, toda conversao conta em dobro e o CPA
   aparece pela metade — que e o jeito mais facil de escalar anuncio ruim
   achando que e bom.

   Deploy e validacao: 08-site/capi/LEIA-ME.md
   ==================================================================== */

window.CAPI = (function () {

  // Worker publicado em 13/09/2026. Se um dia mudar de endereco, o MESMO
  // valor precisa mudar tambem no connect-src do CSP das 4 paginas — senao o
  // navegador bloqueia o fetch em silencio e o pixel continua funcionando,
  // escondendo a falha por semanas.
  var URL_CAPI = 'https://cat-capi.catpromo.workers.dev/e';

  // Vazio ou nao preenchido -> so o pixel dispara. A pagina nunca quebra.
  var ligado = /^https:\/\/[^/]+\//.test(URL_CAPI);

  var origem = (function () {
    try { return new URLSearchParams(location.search).get('utm_source') || 'direto'; }
    catch (e) { return 'direto'; }
  })();

  function novoId() {
    try { return crypto.randomUUID(); }
    catch (e) { return 'e' + Date.now() + '-' + Math.random().toString(16).slice(2); }
  }

  function cookie(nome) {
    var m = document.cookie.match('(^|;)\\s*' + nome + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }

  function param(nome) {
    try { return new URLSearchParams(location.search).get(nome) || ''; }
    catch (e) { return ''; }
  }

  /* `atraso` existe por um motivo so: o pixel grava os cookies _fbp e _fbc de
     forma assincrona, depois que o fbevents.js carrega. Mandar o PageView pro
     Worker no mesmo instante chega sem os dois e derruba a correspondencia do
     evento. O evento do navegador sai na hora de qualquer jeito — o atraso vale
     so pra copia do servidor. */
  function envia(nome, dados, tipo, atraso) {
    var eid = novoId();

    if (window.fbq) fbq(tipo || 'track', nome, dados || {}, { eventID: eid });
    if (!ligado) return;

    var manda = function () {
      try {
        fetch(URL_CAPI, {
          method: 'POST',
          keepalive: true,          // sobrevive a navegacao que o proprio clique dispara
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento:   nome,
            event_id: eid,
            url:      location.href,
            fbp:      cookie('_fbp'),
            fbc:      cookie('_fbc'),
            fbclid:   param('fbclid'),   // o Worker monta o _fbc se o cookie ainda nao existir
            dados:    dados || {}
          })
        }).catch(function () {});
      } catch (e) {}
    };

    if (atraso) setTimeout(manda, atraso); else manda();
  }

  /* PageView sai daqui, nao da pagina: assim nenhuma pagina corre o risco de
     disparar um PageView sem event_id, que a Meta contaria como um segundo
     evento em vez de deduplicar. */
  envia('PageView', {}, 'track', 1000);

  return { envia: envia, origem: origem };
})();
