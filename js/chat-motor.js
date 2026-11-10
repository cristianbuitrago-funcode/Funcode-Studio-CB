/*
 * Funcode Studio CB — «motor» de preguntas frecuentes del chat de Funi (sin IA).
 *
 * Entiende preguntas escritas de muchas formas:
 *   - sin tildes, con errores de ortografía («pajina», «cueta») y letras repetidas («holaaa»);
 *   - abreviaturas de chat («q», «xq», «pq», «wsp», «pag»…);
 *   - plurales y conjugaciones («cuestan», «demoran», «tiendas virtuales»);
 *   - palabras clave en cualquier orden («cuánto me cuesta una página» = «cuánto cuesta página»).
 * Si una pregunta trae dos temas («¿cuánto cuesta y cuánto se demora?») responde los dos.
 * No inventa: si no reconoce la pregunta, propone temas en vez de adivinar.
 *
 * Funciona en el navegador (window.FuncodeChatMotor) y en Node (pruebas).
 */
(function (root) {
  'use strict';

  // Palabras que no aportan significado por sí solas.
  var VACIAS = ('a al algo alguien alla ante aqui asi bien con contra cual cuales de del desde el ella ellas ellos ' +
    'en entre era es esa ese eso esta este esto estoy fue ha han hay la las le les lo los mas me mi mis muy ' +
    'no nos o para pero por porque puede pueden puedo que quiero quisiera se sea ser si sin sobre son su sus ' +
    'tambien te tengo tiene tienen tu tus un una uno unos unas usted ustedes y ya yo favor necesito hacer hacen hace ' +
    'saber sabes quisiera gustaria ustedes alguna algun como cuando cuanto cuanta cuantos cuantas mucho poco ' +
    'funcode studio cb').split(' ');
  var vacias = {};
  VACIAS.forEach(function (w) { vacias[w] = true; });

  // Abreviaturas y palabras equivalentes → forma normal.
  var EQUIVALENTES = {
    q: 'que', k: 'que', ke: 'que', xq: 'porque', pq: 'porque', porq: 'porque', x: 'por', tb: 'tambien', tmb: 'tambien',
    pag: 'pagina', pags: 'pagina', pg: 'pagina', pagweb: 'pagina', website: 'web', sitio: 'web', webs: 'web',
    wsp: 'whatsapp', wpp: 'whatsapp', wasap: 'whatsapp', guasap: 'whatsapp', whats: 'whatsapp', watsap: 'whatsapp', wa: 'whatsapp',
    cel: 'celular', movil: 'celular', telefono: 'celular', dnd: 'donde', info: 'informacion', porfa: 'favor', xfa: 'favor',
    apps: 'app', aplicacion: 'app', aplicaciones: 'app', aplicativo: 'app', programa: 'app',
    ecommerce: 'tienda', eshop: 'tienda', cuestan: 'cuesta', valen: 'vale', cobran: 'cobra',
    demoran: 'demora', tardan: 'tarda', demorar: 'demora', tardar: 'tarda', demoraria: 'demora', tardaria: 'tarda',
    valdria: 'vale', costaria: 'cuesta', saldria: 'sale', cobrarian: 'cobra', cobraria: 'cobra',
    ia: 'inteligencia', ai: 'inteligencia', chatgpt: 'inteligencia', bot: 'chatbot', bots: 'chatbot',
    insta: 'instagram', ig: 'instagram', fb: 'facebook', face: 'facebook',
    plata: 'dinero', lucas: 'dinero', barato: 'economico', caro: 'costoso', costosa: 'costoso'
  };

  function norm(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, ' ')
      .replace(/([a-z])\1{2,}/g, '$1') // «holaaa» → «hola»
      .trim();
  }

  // Raíz sencilla: quita plurales y algunas terminaciones verbales comunes.
  function raiz(w) {
    if (EQUIVALENTES[w]) w = EQUIVALENTES[w];
    if (w.length > 6 && /(mente)$/.test(w)) w = w.slice(0, -5);
    if (w.length > 5 && /es$/.test(w) && !/(ces|ses)$/.test(w)) return w.slice(0, -2);
    if (w.length > 4 && /s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function palabras(texto) {
    return norm(texto).split(' ').filter(Boolean).map(raiz);
  }

  // Distancia de edición con transposición (para errores de tipeo).
  function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    var d = [];
    for (var i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (var j = 0; j <= b.length; j++) { d[0][j] = j; }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // ¿La palabra de la pregunta corresponde a la de la clave? 1 = igual, 0.8 = misma raíz, 0.6 = error de tipeo.
  function parecido(w, k) {
    if (w === k) return 1;
    var corta = Math.min(w.length, k.length);
    if (corta >= 4) {
      var p = 0;
      while (p < corta && w[p] === k[p]) p++;
      if (p >= Math.max(4, corta - 2)) return 0.8;
    }
    if (corta >= 5 && distancia(w, k) <= (corta >= 8 ? 2 : 1)) return 0.6;
    return 0;
  }

  // Prepara las intenciones del archivo de conocimiento (una sola vez).
  function preparar(saber) {
    saber.intenciones.forEach(function (it) {
      it._claves = it.claves.map(function (clave) {
        var todas = palabras(clave);
        var utiles = todas.filter(function (w) { return !vacias[w]; });
        // Si la clave es solo de palabras comunes («qué hacen»), se usa completa pero vale menos.
        return { palabras: utiles.length ? utiles : todas, peso: utiles.length ? 1 : 0.5 };
      });
    });
    return saber;
  }

  // Las definiciones del glosario solo responden preguntas del tipo «¿qué es…?».
  var DEFINICION = /\b(que es|que son|que significa|significa|para que sirve|que quiere decir|explicame|explica)\b/;

  // Puntaje de una intención: la clave que mejor coincide, más un poco por cada clave distinta que también coincide.
  function puntuar(it, pregunta, textoNormal, omitir) {
    var mejorClave = 0;
    var extra = 0;
    var cubiertas = {};
    var vistas = {};
    if (it.tipo === 'glosario' && !DEFINICION.test(textoNormal)) return { intencion: it, puntos: 0, bruto: 0, cubiertas: cubiertas };
    it._claves.forEach(function (clave) {
      var total = 0;
      var usadas = [];
      for (var i = 0; i < clave.palabras.length; i++) {
        var mejor = 0;
        var cual = -1;
        for (var j = 0; j < pregunta.length; j++) {
          if (omitir && omitir[j]) continue;
          var s = parecido(pregunta[j], clave.palabras[i]);
          if (s > mejor) { mejor = s; cual = j; }
        }
        if (!mejor) return; // a la clave le falta una palabra: no cuenta
        total += mejor;
        usadas.push(cual);
      }
      var firma = usadas.slice().sort().join(',');
      var distintas = usadas.filter(function (u, n) { return usadas.indexOf(u) === n; }).length;
      var valor = clave.peso * (total / clave.palabras.length) * (1 + 1.2 * (distintas - 1));
      if (vistas[firma] && vistas[firma] >= valor) return;
      vistas[firma] = valor;
      usadas.forEach(function (u) { cubiertas[u] = true; });
    });
    Object.keys(vistas).forEach(function (f) {
      if (vistas[f] > mejorClave) { extra += mejorClave; mejorClave = vistas[f]; } else { extra += vistas[f]; }
    });
    var bruto = mejorClave + Math.min(extra * 0.25, 1);
    // «prioridad» ordena los temas (por ejemplo, «precio» antes que «página web») sin cambiar si hay respuesta.
    return { intencion: it, puntos: bruto * (it.prioridad || 1), bruto: bruto, cubiertas: cubiertas };
  }

  /**
   * Busca la mejor respuesta.
   * Devuelve { respuestas: [intención, …], sugerencias: [intención, …] }.
   *   - respuestas: una o dos intenciones seguras (dos si la pregunta trae dos temas distintos).
   *   - sugerencias: temas parecidos cuando no hay una respuesta segura.
   */
  function buscar(saber, texto) {
    var pregunta = palabras(texto);
    var textoNormal = norm(texto);
    if (!pregunta.length) return { respuestas: [], sugerencias: [] };
    // Las palabras de un saludo de varias palabras («buenos días») no cuentan para otros temas.
    var mascara = {};
    saber.intenciones.forEach(function (it) {
      if (it.tipo !== 'charla') return;
      it._claves.forEach(function (c) {
        if (c.palabras.length < 2) return;
        var usados = c.palabras.map(function (k) {
          for (var j = 0; j < pregunta.length; j++) if (parecido(pregunta[j], k) >= 0.8) return j;
          return -1;
        });
        if (usados.indexOf(-1) === -1) usados.forEach(function (j) { mascara[j] = true; });
      });
    });
    var lista = saber.intenciones.map(function (it) {
      return puntuar(it, pregunta, textoNormal, it.tipo === 'charla' ? null : mascara);
    })
      .filter(function (r) { return r.puntos > 0; })
      .sort(function (a, b) { return b.puntos - a.puntos; });

    var charla = function (r) { return r.intencion.tipo === 'charla'; };
    // Si el mensaje es solo cortesía («buenos días», «listo, entendido»), se responde como charla.
    var social0 = lista.filter(charla)[0];
    if (social0 && social0.bruto >= 1) {
      var importantes = pregunta.filter(function (w) { return !vacias[w]; });
      var todas = importantes.every(function (w) { return social0.cubiertas[pregunta.indexOf(w)]; });
      if (todas) return { respuestas: [social0.intencion], sugerencias: [] };
    }
    // Un saludo o un «gracias» solo gana si no hay otra pregunta en el mensaje.
    var temas = lista.filter(function (r) { return !charla(r); });
    var seguros = temas.filter(function (r) { return r.bruto >= 1; });
    var mejor = seguros[0] || null;
    if (!mejor) {
      var social = lista.filter(charla)[0];
      if (social && social.bruto >= 1) return { respuestas: [social.intencion], sugerencias: [] };
      return { respuestas: [], sugerencias: temas.slice(0, 3).map(function (r) { return r.intencion; }) };
    }

    var respuestas = [mejor.intencion];
    var segundo = seguros[1];
    if (segundo && segundo.bruto >= 2 && segundo.puntos >= mejor.puntos * 0.6) {
      // Segundo tema solo si usa palabras importantes que el primero no usó.
      var propias = Object.keys(segundo.cubiertas).filter(function (k) {
        return !mejor.cubiertas[k] && !vacias[pregunta[k]];
      });
      if (propias.length && segundo.intencion.grupo !== mejor.intencion.grupo) respuestas.push(segundo.intencion);
    }
    return { respuestas: respuestas, sugerencias: [] };
  }

  var motor = { norm: norm, palabras: palabras, preparar: preparar, buscar: buscar, distancia: distancia };
  if (typeof module !== 'undefined' && module.exports) module.exports = motor;
  else root.FuncodeChatMotor = motor;
})(this);
