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

  /*
   * ID DO VISITANTE — o unico identificador de PESSOA que este funil tem.
   *
   * Em 24/09/2026 a nota de correspondencia do `Lead` estava em 5.9/10. Os
   * quatro sinais que a gente mandava — ip, user agent, _fbp e _fbc — sao todos
   * de NAVEGADOR: a Meta usa, mas nenhum deles diz "esta e a fulana". Por isso
   * a nota nao passa da metade por mais parametro de browser que se mande.
   *
   * A saida obvia seria pedir e-mail, e ela esta DESCARTADA de proposito: a
   * pagina inteira existe pra levar do anuncio ao grupo em um clique, e botar
   * formulario no meio troca conversao de verdade por nota de painel.
   *
   * Entao fica isto: um id aleatorio, gravado uma vez, estavel enquanto o
   * navegador guardar. Nao identifica ninguem pra nos — e nao precisa. Serve pra
   * Meta reconhecer que dois eventos sao da MESMA pessoa, que e exatamente o que
   * falta na conta hoje. Vai com hash no Worker, nunca cru.
   *
   * localStorage E NAO cookie: cookie de primeira parte em Safari morre em 7
   * dias (ITP), e o ciclo de decisao aqui passa disso. Se o navegador bloquear
   * storage (aba anonima, ITP agressivo), a funcao devolve '' e o campo some —
   * o evento continua saindo com o que tem.
   */
  var CHAVE_VISITANTE = 'cat_vid';

  function visitante() {
    try {
      var v = localStorage.getItem(CHAVE_VISITANTE);
      if (!v) {
        v = (crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem(CHAVE_VISITANTE, v);
      }
      return v;
    } catch (e) { return ''; }
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
          /* text/plain E NAO application/json (revisao de 26/11/2026): JSON
             entre dominios exige a pergunta previa (preflight), e o Lead sai
             no clique que ja esta levando a pessoa embora: a pergunta morria
             com a pagina e a copia do servidor nao chegava. text/plain e
             pedido simples, sem pergunta, e o Worker le o corpo como texto e
             faz o JSON.parse ele mesmo (leCorpoJson em capi/worker.js). */
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            evento:   nome,
            event_id: eid,
            url:      location.href,
            fbp:      cookie('_fbp'),
            fbc:      cookie('_fbc'),
            fbclid:   param('fbclid'),   // o Worker monta o _fbc se o cookie ainda nao existir
            external_id: visitante(),
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

  /* UM LEAD POR SESSAO (27/11/2026, pedido do Pedro). O Lead saia a cada
     clique: quem clicava em entrar, voltava pela seta e clicava de novo, ou
     usava o botao do aviso de saida depois do principal, virava duas ou tres
     pessoas pra Meta. Agora e um por aba: sessionStorage vale enquanto a aba
     esta aberta, entao abrir o anuncio de novo noutra aba e visita nova. Vale
     pra todas as paginas do dominio, porque a pessoa e a mesma. Sem storage
     (aba anonima com bloqueio), cai pra um por carregamento de pagina.
     Devolve true quando mandou (quem chama usa pra nao repetir o TikTok).
     Cada evento tem a sua trava: o Lead do WhatsApp e o do Telegram (abaixo)
     sao conversoes diferentes e um nao apaga o outro. */
  var jaNestaPagina = {};
  function umaVezPorSessao(nome, dados, tipo) {
    var chave = nome === 'Lead' ? 'cat_lead_sessao' : 'cat_sessao_' + nome;
    if (jaNestaPagina[nome]) return false;
    try { if (sessionStorage.getItem(chave)) return false; } catch (e) {}
    jaNestaPagina[nome] = true;
    try { sessionStorage.setItem(chave, String(Date.now())); } catch (e) {}
    envia(nome, dados, tipo);
    return true;
  }
  function lead(dados) { return umaVezPorSessao('Lead', dados); }

  /* LEAD DO TELEGRAM (27/11/2026, pedido do Pedro). O clique que leva pro
     canal do Telegram (/tech-telegram/ e o botao de Telegram da /cupons/)
     mandava `Lead`, o mesmo evento do clique pro grupo do WhatsApp, no mesmo
     conjunto de dados: a campanha que otimiza por Lead aprenderia com quem foi
     pro Telegram, e o Lead do Gerenciador somava os dois destinos. Agora e um
     evento personalizado proprio. Nenhuma campanha otimiza por ele (em 27/11
     as 18 ativas iam pra /tech-min/); pra anunciar pro Telegram um dia, criar
     uma conversao personalizada com ele no Gerenciador de Eventos. O Worker so
     aceita evento da lista dele: LeadTelegram esta em EVENTOS_CUSTOM. */
  function leadTelegram(dados) { return umaVezPorSessao('LeadTelegram', dados, 'trackCustom'); }

  return { envia: envia, lead: lead, leadTelegram: leadTelegram, origem: origem };
})();
