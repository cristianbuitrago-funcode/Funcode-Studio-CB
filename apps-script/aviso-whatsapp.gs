/**
 * Funcode Studio CB — Aviso por WhatsApp cuando llega una solicitud nueva.
 *
 * Este código va en Google Apps Script (https://script.google.com), NO en la página.
 * La página le avisa a este script y el script te escribe por WhatsApp usando CallMeBot.
 * Tu llave de CallMeBot queda guardada aquí, en «Propiedades de la secuencia de comandos»,
 * y nunca aparece en la página pública.
 *
 * Propiedades que debes crear (Configuración del proyecto → Propiedades de la secuencia de comandos):
 *   CALLMEBOT_APIKEY  → la llave que te envió CallMeBot por WhatsApp
 *   WHATSAPP_PHONE    → exactamente lo que dice el mensaje de CallMeBot después de «Activated for».
 *                       Puede ser un número (573001234567) o un identificador que termina
 *                       en @lid (109040663277680@lid). Cópialo tal cual.
 *
 * Instrucciones completas: AVISO-WHATSAPP.md en el repositorio.
 */

var PANEL_URL = 'https://cristianbuitrago-funcode.github.io/Funcode-Studio-CB/admin.html';
var TIPOS = ['Página web', 'Aplicación web', 'Solución educativa', 'Mejora de página existente', 'Integración de IA', 'Otro'];
var MAX_AVISOS_POR_HORA = 10; // protección contra spam: nadie puede llenarte el WhatsApp de mensajes

/** La página llama a esta función cada vez que alguien envía el formulario. */
function doPost(e) {
  var datos;
  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return respuesta({ ok: false, error: 'datos inválidos' });
  }

  var nombre = limpiar(datos.nombre, 80);
  var tipo = limpiar(datos.tipo, 40);
  var presupuesto = limpiar(datos.presupuesto, 60) || 'Aún no lo sabe';
  if (!nombre || TIPOS.indexOf(tipo) === -1) {
    return respuesta({ ok: false, error: 'solicitud incompleta' });
  }

  if (!dentroDelLimite()) {
    return respuesta({ ok: false, error: 'límite de avisos alcanzado' });
  }

  var mensaje = '🔔 *Nueva solicitud en Funcode Studio CB*\n' +
    '👤 ' + nombre + '\n' +
    '🧩 ' + tipo + '\n' +
    '💰 ' + presupuesto + '\n\n' +
    'Revísala en el panel: ' + PANEL_URL;

  return respuesta(enviarWhatsApp(mensaje));
}

/** Para probar desde el editor: selecciona «probarAviso» y pulsa «Ejecutar». */
function probarAviso() {
  var resultado = enviarWhatsApp('✅ Prueba de Funcode Studio CB: los avisos por WhatsApp funcionan.');
  Logger.log('Número usado: ' + PropertiesService.getScriptProperties().getProperty('WHATSAPP_PHONE'));
  Logger.log('Respuesta de CallMeBot: ' + (resultado.detalle || resultado.error));
  if (!resultado.ok) throw new Error('No se pudo enviar: ' + resultado.error);
  Logger.log('Listo: revisa tu WhatsApp (puede tardar hasta 1 minuto).');
}

function enviarWhatsApp(texto) {
  var props = PropertiesService.getScriptProperties();
  var apikey = props.getProperty('CALLMEBOT_APIKEY');
  var telefono = normalizarDestino(props.getProperty('WHATSAPP_PHONE'));
  if (!apikey || !telefono) {
    return { ok: false, error: 'Faltan las propiedades CALLMEBOT_APIKEY o WHATSAPP_PHONE' };
  }

  var url = 'https://api.callmebot.com/whatsapp.php' +
    // La «@» del identificador @lid va sin codificar: CallMeBot no acepta «%40».
    '?phone=' + encodeURIComponent(telefono).replace(/%40/g, '@') +
    '&text=' + encodeURIComponent(texto) +
    '&apikey=' + encodeURIComponent(apikey);

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var codigo = res.getResponseCode();
  // CallMeBot a veces responde 200 con un mensaje de error en el texto (p. ej. APIKey inválida).
  var detalle = res.getContentText().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (codigo >= 200 && codigo < 300 && !/error|invalid|not valid|not activated|wrong/i.test(detalle)) {
    return { ok: true, detalle: detalle };
  }
  return { ok: false, error: 'CallMeBot respondió ' + codigo + ': ' + detalle };
}

// CallMeBot identifica el destino con un número o con un identificador de WhatsApp «...@lid».
function normalizarDestino(valor) {
  var texto = String(valor || '').trim().replace(/\s+/g, '');
  var lid = texto.match(/^(\d+)@lid$/i);
  if (lid) return lid[1] + '@lid';
  return texto.replace(/\D/g, '');
}

function dentroDelLimite() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var cache = CacheService.getScriptCache();
    var usados = Number(cache.get('avisos_hora') || 0);
    if (usados >= MAX_AVISOS_POR_HORA) return false;
    cache.put('avisos_hora', String(usados + 1), 3600);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function limpiar(valor, max) {
  return String(valor || '').replace(/[\r\n\t]+/g, ' ').replace(/[*_~`]/g, '').trim().slice(0, max);
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
