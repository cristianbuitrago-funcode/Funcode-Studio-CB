/**
 * Funcode Studio CB — Aviso de solicitudes nuevas (correo + WhatsApp).
 *
 * Este código va en Google Apps Script (https://script.google.com), NO en la página.
 * Cada vez que alguien envía el formulario:
 *   1. Te llega SIEMPRE un correo a tu Gmail (oficial de Google, no falla).
 *   2. Si configuraste CallMeBot, también te llega un WhatsApp.
 *
 * Propiedades (Configuración del proyecto → Propiedades de script), todas opcionales:
 *   AVISO_EMAIL       → correo que recibe los avisos. Si no existe, se usa tu cuenta de Google.
 *   CALLMEBOT_APIKEY  → la llave que te envió CallMeBot por WhatsApp.
 *   WHATSAPP_PHONE    → lo que dice CallMeBot después de «Activated for»:
 *                       un número (573001234567) o un identificador «…@lid».
 *
 * Instrucciones completas: AVISO-WHATSAPP.md en el repositorio.
 */

var PANEL_URL = 'https://cristianbuitrago-funcode.github.io/Funcode-Studio-CB/admin.html';
var TIPOS = ['Página web', 'Aplicación web', 'Solución educativa', 'Mejora de página existente', 'Integración de IA', 'Otro'];
var MAX_AVISOS_POR_HORA = 10; // protección contra spam

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

  return respuesta(avisar(nombre, tipo, presupuesto));
}

/** Para probar desde el editor: selecciona «probarAviso» y pulsa «Ejecutar». */
function probarAviso() {
  var r = avisar('Cliente de prueba', 'Página web', '$160.000 – $400.000 COP');
  Logger.log('Correo: ' + (r.correo.ok ? 'enviado a ' + r.correo.detalle : 'ERROR ' + r.correo.error));
  Logger.log('WhatsApp: ' + (r.whatsapp.ok ? 'enviado (' + r.whatsapp.detalle + ')' : r.whatsapp.error));
  if (!r.correo.ok && !r.whatsapp.ok) throw new Error('No se pudo enviar ningún aviso.');
  Logger.log('Listo: revisa tu correo' + (r.whatsapp.ok ? ' y tu WhatsApp.' : '.'));
}

function avisar(nombre, tipo, presupuesto) {
  var lineas = ['👤 ' + nombre, '🧩 ' + tipo, '💰 ' + presupuesto, '', 'Revísala en el panel: ' + PANEL_URL];
  return {
    ok: true,
    correo: enviarCorreo('🔔 Nueva solicitud: ' + nombre + ' – ' + tipo,
      'Llegó una nueva solicitud desde la página de Funcode Studio CB.\n\n' + lineas.join('\n')),
    whatsapp: enviarWhatsApp('🔔 *Nueva solicitud en Funcode Studio CB*\n' + lineas.join('\n'))
  };
}

function enviarCorreo(asunto, cuerpo) {
  try {
    var destino = PropertiesService.getScriptProperties().getProperty('AVISO_EMAIL') ||
      Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({ to: destino, subject: asunto, body: cuerpo, name: 'Funcode Studio CB' });
    return { ok: true, detalle: destino };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function enviarWhatsApp(texto) {
  var props = PropertiesService.getScriptProperties();
  var apikey = props.getProperty('CALLMEBOT_APIKEY');
  var destino = normalizarDestino(props.getProperty('WHATSAPP_PHONE'));
  if (!apikey || !destino) {
    return { ok: false, error: 'WhatsApp no configurado (faltan CALLMEBOT_APIKEY o WHATSAPP_PHONE)' };
  }

  var url = 'https://api.callmebot.com/whatsapp.php' +
    // «+» se codifica como %2B; la «@» del identificador @lid va sin codificar.
    '?phone=' + encodeURIComponent(destino).replace(/%40/g, '@') +
    '&text=' + encodeURIComponent(texto) +
    '&apikey=' + encodeURIComponent(apikey);

  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var codigo = res.getResponseCode();
    // CallMeBot a veces responde 2xx con un error en el texto (p. ej. «APIKey is invalid»).
    var detalle = res.getContentText().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (codigo >= 200 && codigo < 300 && !/error|invalid|not valid|not activated|wrong/i.test(detalle)) {
      return { ok: true, detalle: detalle };
    }
    return { ok: false, error: 'CallMeBot respondió ' + codigo + ': ' + detalle };
  } catch (err) {
    return { ok: false, error: 'No se pudo conectar con CallMeBot: ' + (err && err.message || err) };
  }
}

// Número internacional con «+», o identificador de WhatsApp «…@lid» tal cual.
function normalizarDestino(valor) {
  var texto = String(valor || '').trim().replace(/\s+/g, '');
  var lid = texto.match(/^(\d+)@lid$/i);
  if (lid) return lid[1] + '@lid';
  var digitos = texto.replace(/\D/g, '');
  return digitos ? '+' + digitos : '';
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
