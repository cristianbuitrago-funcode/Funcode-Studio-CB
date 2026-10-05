/*
 * Funcode Studio CB — Generador de documentos del panel del organizador.
 * Flujo: Datos → Contenido → Vista previa → Descargar (Word o PDF).
 * Los borradores se guardan en Firestore (colección «documentos», solo el organizador).
 * admin.js lo inicia cuando confirma que la cuenta tiene acceso.
 */
(function () {
  'use strict';

  var M = window.FuncodeDocModelo;
  var A = window.FuncodeDocArchivos;
  var $ = function (id) { return document.getElementById(id); };
  if (!M || !A || !$('docs-editor')) return;

  var ESTADOS_DOC = [
    { id: 'borrador', label: 'Borrador' },
    { id: 'generado', label: 'Generado' },
    { id: 'enviado', label: 'Enviado al cliente' },
    { id: 'aceptado', label: 'Aceptado' },
    { id: 'rechazado', label: 'No aceptado' }
  ];
  var LISTAS = { alcance: 'Alcance incluido', diseno: 'Diseño y experiencia', incluye: 'Incluye', noIncluye: 'No incluye' };
  var RECIENTES = 8;

  var db = null;
  var abrirPestana = null;
  var unsubscribe = null;
  var docs = [];
  var docsError = '';
  var verTodos = false;
  var busqueda = '';

  var estado = null;        // datos del documento abierto
  var docId = null;         // id en Firestore (null = aún no guardado)
  var existe = false;       // ya está guardado en Firestore
  var docEstado = 'borrador';
  var paso = 1;
  var sucio = false;
  var numeroManual = false;
  var ocupado = false;
  var ultimaUrl = null;     // archivo generado más reciente (enlace «Descargar de nuevo»)

  var form = $('doc-form');
  var editor = $('docs-editor');
  var home = $('docs-home');

  /* ---------- Preparación del formulario ---------- */
  M.TIPOS_PROYECTO.forEach(function (t) {
    var o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    $('doc-tipoProyecto').appendChild(o);
  });
  ESTADOS_DOC.forEach(function (e) {
    var o = document.createElement('option');
    o.value = e.id;
    o.textContent = e.label;
    $('doc-estado').appendChild(o);
  });
  M.COMPROMISO.forEach(function (t) {
    var p = document.createElement('p');
    p.textContent = t;
    $('doc-compromiso').appendChild(p);
  });

  function txt(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function etiquetaEstado(id) {
    for (var i = 0; i < ESTADOS_DOC.length; i++) if (ESTADOS_DOC[i].id === id) return ESTADOS_DOC[i].label;
    return id;
  }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  var fechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  var hora = new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' });

  /* ---------- Documentos guardados (Firestore) ---------- */
  function iniciar(opciones) {
    db = opciones.db;
    abrirPestana = opciones.abrir;
    if (unsubscribe) return;
    unsubscribe = db.collection('documentos').orderBy('actualizado', 'desc').onSnapshot(function (snap) {
      docsError = '';
      docs = snap.docs.map(function (d) {
        var data = d.data({ serverTimestamps: 'estimate' });
        data.id = d.id;
        return data;
      });
      renderRecientes();
      revisarNumero();
    }, function (err) {
      unsubscribe = null;
      docs = [];
      docsError = err.code === 'permission-denied'
        ? 'No se pudieron cargar los documentos guardados porque faltan las reglas nuevas de Firestore (ver FIREBASE.md). Puedes crear y descargar documentos igual, pero no guardarlos.'
        : 'No se pudieron cargar los documentos guardados: ' + (err.message || err);
      renderRecientes();
    });
  }

  function detener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    db = null;
    docs = [];
    docsError = '';
    sucio = false;
    cerrarEditor();
    renderRecientes();
  }

  function siguienteNumero(tipo) {
    var max = 0;
    docs.forEach(function (d) {
      if (d.tipo === tipo && /^\d+$/.test(d.numero || '')) max = Math.max(max, parseInt(d.numero, 10));
    });
    return String(max + 1).padStart(3, '0');
  }

  function guardar(silencioso) {
    if (!db) return Promise.reject(new Error('Inicia sesión de nuevo para guardar.'));
    var ref = docId ? db.collection('documentos').doc(docId) : db.collection('documentos').doc();
    docId = ref.id;
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    var data = {
      tipo: estado.tipo,
      numero: txt(estado.numero).slice(0, 20),
      cliente: txt(estado.cliente).slice(0, 100),
      proyecto: txt(estado.proyecto).slice(0, 120),
      fecha: String(estado.fecha || '').slice(0, 10),
      estado: docEstado,
      datos: JSON.parse(JSON.stringify(estado)),
      actualizado: ts
    };
    if (!existe) data.creado = ts;
    var cambiosAntes = sucio;
    if (!silencioso) mostrarGuardado('Guardando…');
    return ref.set(data, { merge: true }).then(function () {
      existe = true;
      // Si se editó algo mientras se guardaba, sigue habiendo cambios sin guardar.
      if (cambiosAntes === sucio) sucio = false;
      $('doc-eliminar').hidden = false;
      mostrarGuardado('💾 Guardado a las ' + hora.format(new Date()));
      return true;
    }, function (err) {
      mostrarGuardado('');
      throw new Error(err.code === 'permission-denied'
        ? 'Firestore rechazó el guardado. Publica las reglas nuevas de firestore.rules (ver FIREBASE.md).'
        : (err.message || String(err)));
    });
  }

  function mostrarGuardado(texto) {
    $('doc-save-state').textContent = texto || (sucio ? 'Cambios sin guardar' : '');
  }

  function marcarSucio() {
    sucio = true;
    mostrarGuardado('Cambios sin guardar');
  }

  /* ---------- Documentos recientes ---------- */
  function renderRecientes() {
    var cont = $('docs-recent');
    cont.innerHTML = '';
    var q = busqueda;
    var lista = docs.filter(function (d) {
      if (!q) return true;
      return [d.cliente, d.proyecto, d.numero, M.NOMBRES[d.tipo] ? M.NOMBRES[d.tipo].corto : '', etiquetaEstado(d.estado)]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var visibles = verTodos || q ? lista : lista.slice(0, RECIENTES);
    visibles.forEach(function (d) { cont.appendChild(tarjeta(d)); });

    var empty = $('docs-empty');
    empty.hidden = visibles.length > 0;
    empty.textContent = docsError || (docs.length
      ? 'No hay documentos que coincidan con la búsqueda.'
      : 'Todavía no hay documentos guardados. Crea una cotización o una propuesta y pulsa «Guardar borrador» o genera el archivo.');
    $('docs-more').hidden = verTodos || !!q || lista.length <= RECIENTES;
  }

  function tarjeta(d) {
    var nombres = M.NOMBRES[d.tipo] || M.NOMBRES.cotizacion;
    var card = el('article', { class: 'request doc-card', 'data-doc-estado': d.estado });
    var head = el('header', { class: 'request-head' });
    var who = el('div');
    who.appendChild(el('p', { class: 'doc-card-type' }, nombres.corto + ' N.º ' + (d.numero || '—')));
    who.appendChild(el('h4', null, d.cliente || 'Sin cliente'));
    who.appendChild(el('p', { class: 'request-business' }, d.proyecto || 'Sin nombre de proyecto'));
    head.appendChild(who);
    head.appendChild(el('span', { class: 'status-pill' }, etiquetaEstado(d.estado)));
    card.appendChild(head);

    var meta = [];
    if (M.fechaCorta(d.fecha)) meta.push('Fecha: ' + M.fechaCorta(d.fecha));
    if (d.actualizado && d.actualizado.toDate) meta.push('Editado: ' + fechaHora.format(d.actualizado.toDate()));
    var valor = d.datos && M.dinero(d.datos.valor);
    if (valor) meta.push('Valor: ' + valor);
    card.appendChild(el('p', { class: 'request-email' }, meta.join(' · ')));

    var actions = el('div', { class: 'doc-card-actions' });
    var editar = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Editar');
    editar.addEventListener('click', function () { confirmarSalida(function () { abrirGuardado(d, false); }); });
    var duplicar = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Duplicar');
    duplicar.addEventListener('click', function () { confirmarSalida(function () { abrirGuardado(d, true); }); });

    var estadoField = el('label', { class: 'request-field doc-card-state' });
    estadoField.appendChild(el('span', { class: 'sr-only' }, 'Estado de ' + nombres.corto.toLowerCase() + ' ' + (d.numero || '')));
    var select = el('select');
    ESTADOS_DOC.forEach(function (e) {
      var o = el('option', { value: e.id }, e.label);
      if (e.id === d.estado) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', function () {
      db.collection('documentos').doc(d.id).update({
        estado: select.value,
        actualizado: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function (err) { window.alert('No se pudo cambiar el estado: ' + (err.message || err)); });
      if (d.id === docId) { docEstado = select.value; $('doc-estado').value = select.value; }
    });
    estadoField.appendChild(select);

    var eliminar = el('button', { class: 'btn-link-danger', type: 'button' }, 'Eliminar');
    eliminar.addEventListener('click', function () { eliminarDoc(d.id, nombres.corto.toLowerCase() + ' N.º ' + d.numero + ' de ' + (d.cliente || 'sin cliente')); });

    actions.appendChild(editar);
    actions.appendChild(duplicar);
    actions.appendChild(estadoField);
    actions.appendChild(eliminar);
    card.appendChild(actions);
    return card;
  }

  function eliminarDoc(id, descripcion) {
    if (!window.confirm('¿Eliminar la ' + descripcion + '? No se puede deshacer. Los archivos que ya descargaste no se borran.')) return;
    db.collection('documentos').doc(id).delete().then(function () {
      if (id === docId) { sucio = false; cerrarEditor(); }
    }, function (err) {
      window.alert('No se pudo eliminar: ' + (err.message || err));
    });
  }

  $('docs-more').addEventListener('click', function () { verTodos = true; renderRecientes(); });
  $('docs-search').addEventListener('input', function (e) {
    busqueda = e.target.value.trim().toLowerCase();
    renderRecientes();
  });

  /* ---------- Abrir y cerrar el editor ---------- */
  function confirmarSalida(siguiente) {
    if (!editor.hidden && sucio && !window.confirm('Tienes cambios sin guardar en este documento. ¿Salir sin guardarlos?')) return;
    sucio = false;
    siguiente();
  }

  function abrirEditor(datos, opciones) {
    opciones = opciones || {};
    estado = M.completar(datos);
    docId = opciones.id || null;
    existe = !!opciones.id;
    docEstado = opciones.estado || 'borrador';
    numeroManual = !!opciones.id;
    sucio = !!opciones.sucio;
    llenarFormulario();
    ocultarErrores();
    $('doc-result').hidden = true;
    $('doc-eliminar').hidden = !existe;
    mostrarGuardado(existe ? 'Borrador guardado' : '');
    home.hidden = true;
    editor.hidden = false;
    irA(1);
    $('doc-editor-title').focus();
  }

  function liberarArchivo() {
    if (ultimaUrl) URL.revokeObjectURL(ultimaUrl);
    ultimaUrl = null;
  }

  function cerrarEditor() {
    liberarArchivo();
    editor.hidden = true;
    home.hidden = false;
    estado = null;
    docId = null;
    existe = false;
  }

  function nuevoDocumento(tipo, base) {
    var datos = M.nuevo(tipo, siguienteNumero(tipo));
    Object.keys(base || {}).forEach(function (k) { if (base[k]) datos[k] = base[k]; });
    abrirEditor(datos, { sucio: !!base });
  }

  function abrirGuardado(d, duplicar) {
    if (!duplicar) {
      abrirEditor(d.datos || {}, { id: d.id, estado: d.estado });
      return;
    }
    var datos = M.completar(d.datos || {});
    datos.numero = siguienteNumero(datos.tipo);
    datos.fecha = M.hoy();
    datos.solicitudId = '';
    abrirEditor(datos, { sucio: true });
    mostrarGuardado('Copia nueva sin guardar');
  }

  $('doc-volver').addEventListener('click', function () { confirmarSalida(cerrarEditor); });

  document.querySelectorAll('[data-nuevo]').forEach(function (btn) {
    btn.addEventListener('click', function () { nuevoDocumento(btn.getAttribute('data-nuevo')); });
  });

  window.addEventListener('beforeunload', function (e) {
    if (!editor.hidden && sucio) { e.preventDefault(); e.returnValue = ''; }
  });

  // Desde una solicitud del panel: el cliente y su idea ya quedan escritos.
  var TIPO_DESDE_SOLICITUD = {
    'Página web': 'Página web', 'Aplicación web': 'Aplicación web', 'Solución educativa': 'Plataforma educativa',
    'Mejora de página existente': 'Mejora de proyecto existente'
  };
  function desdeSolicitud(item, tipo) {
    confirmarSalida(function () {
      if (abrirPestana) abrirPestana();
      var tipoProyecto = TIPO_DESDE_SOLICITUD[item.tipo] || 'Otro';
      var base = {
        cliente: txt(item.nombre),
        correo: txt(item.correo),
        telefono: txt(item.whatsapp),
        tipoProyecto: tipoProyecto,
        tipoOtro: tipoProyecto === 'Otro' && item.tipo !== 'Otro' ? item.tipo : '',
        proyecto: item.negocio ? txt(item.tipo) + ' de ' + txt(item.negocio) : '',
        solicitudId: item.id
      };
      base[tipo === 'propuesta' ? 'problema' : 'descripcion'] = String(item.descripcion || '').trim();
      nuevoDocumento(tipo, base);
    });
  }

  /* ---------- Formulario ---------- */
  function campo(name) { return form.elements.namedItem(name); }

  function formatoValor(v) {
    var d = M.digitos(v).replace(/^0+(?=\d)/, '');
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function llenarFormulario() {
    ['numero', 'fecha', 'cliente', 'telefono', 'correo', 'proyecto', 'tipoProyecto', 'tipoOtro', 'descripcion',
      'formaPago', 'tiempo', 'cambios', 'condiciones', 'problema', 'solucionNombre', 'solucion', 'proximoPaso'
    ].forEach(function (name) { campo(name).value = estado[name] == null ? '' : estado[name]; });
    campo('valor').value = formatoValor(estado.valor);
    campo('vigencia').value = estado.vigencia || '';
    form.querySelectorAll('input[name="tipo"]').forEach(function (r) { r.checked = r.value === estado.tipo; });
    $('doc-estado').value = docEstado;
    form.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    ['alcance', 'diseno', 'incluye', 'noIncluye', 'funcionalidades'].forEach(renderLista);
    renderProceso();
    aplicarTipo();
    revisarNumero();
  }

  function aplicarTipo() {
    editor.querySelectorAll('[data-solo]').forEach(function (n) { n.hidden = n.getAttribute('data-solo') !== estado.tipo; });
    $('doc-tipoOtro-field').hidden = estado.tipoProyecto !== 'Otro';
    var nombres = M.NOMBRES[estado.tipo];
    $('doc-editor-title').textContent = (existe ? 'Editar ' + nombres.corto.toLowerCase() : 'Nueva ' + nombres.corto.toLowerCase()) +
      (txt(estado.cliente) ? ' · ' + txt(estado.cliente) : '');
  }

  function revisarNumero() {
    if (!estado) return;
    var numero = txt(estado.numero);
    var repetido = docs.some(function (d) { return d.id !== docId && d.tipo === estado.tipo && d.numero === numero; });
    var hint = $('doc-numero-hint');
    hint.textContent = repetido
      ? '⚠️ Ya existe una ' + M.NOMBRES[estado.tipo].corto.toLowerCase() + ' con este número. Puedes usarlo igual o cambiarlo.'
      : 'Se sugiere el siguiente número disponible. Puedes cambiarlo.';
    hint.classList.toggle('is-warning', repetido);
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); });

  form.addEventListener('input', function (e) {
    var t = e.target;
    if (!estado) return;
    t.removeAttribute('aria-invalid');
    var lista = t.getAttribute('data-item');
    if (lista) {
      var i = Number(t.getAttribute('data-index'));
      var prop = t.getAttribute('data-prop');
      if (prop) estado[lista][i][prop] = t.value;
      else estado[lista][i] = t.value;
      var cont = t.closest('.doc-list');
      if (cont) cont.removeAttribute('aria-invalid');
    } else if (t.name === 'valor') {
      t.value = formatoValor(t.value);
      estado.valor = M.digitos(t.value);
    } else if (t.name === 'vigencia') {
      estado.vigencia = Number(t.value) || 0;
    } else if (t.name && t.name !== 'tipo' && t.name in estado) {
      estado[t.name] = t.value;
      if (t.name === 'numero') { numeroManual = true; revisarNumero(); }
      if (t.name === 'cliente') aplicarTipo();
    } else {
      return;
    }
    marcarSucio();
  });

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (!estado) return;
    if (t.name === 'tipo' && t.checked) {
      estado.tipo = t.value;
      if (!numeroManual) {
        estado.numero = siguienteNumero(estado.tipo);
        campo('numero').value = estado.numero;
      }
      aplicarTipo();
      revisarNumero();
      marcarSucio();
    } else if (t.name === 'tipoProyecto') {
      estado.tipoProyecto = t.value;
      aplicarTipo();
      marcarSucio();
    }
  });

  $('doc-estado').addEventListener('change', function (e) {
    docEstado = e.target.value;
    marcarSucio();
  });

  /* ---------- Listas dinámicas ---------- */
  function boton(attrs, text) { return el('button', Object.assign({ type: 'button', class: 'doc-tool' }, attrs), text); }

  function herramientas(i, total, nombre) {
    var tools = el('div', { class: 'doc-item-tools' });
    var up = boton({ 'data-mover': '-1', 'aria-label': 'Subir ' + nombre }, '↑');
    var down = boton({ 'data-mover': '1', 'aria-label': 'Bajar ' + nombre }, '↓');
    up.disabled = i === 0;
    down.disabled = i === total - 1;
    tools.appendChild(up);
    tools.appendChild(down);
    tools.appendChild(boton({ 'data-quitar': '', 'aria-label': 'Eliminar ' + nombre, class: 'doc-tool doc-tool--danger' }, '✕'));
    return tools;
  }

  function renderLista(nombre) {
    var cont = form.querySelector('[data-lista="' + nombre + '"]');
    cont.innerHTML = '';
    var items = estado[nombre];
    items.forEach(function (item, i) {
      var row = el('div', { class: 'doc-item', 'data-index': i });
      if (nombre === 'funcionalidades') {
        var etiqueta = 'funcionalidad ' + (i + 1);
        row.className = 'doc-item doc-item--card';
        var top = el('div', { class: 'doc-item-head' });
        top.appendChild(el('span', { class: 'doc-item-num' }, 'Funcionalidad ' + (i + 1)));
        top.appendChild(herramientas(i, items.length, etiqueta));
        row.appendChild(top);
        var nombreIn = el('input', { type: 'text', maxlength: '120', 'data-item': nombre, 'data-index': i, 'data-prop': 'nombre',
          'aria-label': 'Nombre de la ' + etiqueta, placeholder: 'Nombre (ej.: Catálogo de productos)' });
        nombreIn.value = item.nombre || '';
        var desc = el('textarea', { rows: '2', maxlength: '1500', 'data-item': nombre, 'data-index': i, 'data-prop': 'descripcion',
          'aria-label': 'Descripción de la ' + etiqueta, placeholder: 'Descripción: qué hace y para qué le sirve al cliente' });
        desc.value = item.descripcion || '';
        row.appendChild(nombreIn);
        row.appendChild(desc);
      } else {
        var label = 'elemento ' + (i + 1) + ' de «' + LISTAS[nombre] + '»';
        var input = el('input', { type: 'text', maxlength: '300', 'data-item': nombre, 'data-index': i, 'aria-label': label.charAt(0).toUpperCase() + label.slice(1),
          enterkeyhint: 'next', placeholder: nombre === 'noIncluye' ? 'Ej.: Compra del dominio' : 'Escribe un elemento' });
        input.value = item;
        row.appendChild(input);
        row.appendChild(herramientas(i, items.length, label));
      }
      cont.appendChild(row);
    });
  }

  function renderProceso() {
    var cont = $('doc-proceso');
    cont.innerHTML = '';
    estado.proceso.forEach(function (etapa, i) {
      var row = el('div', { class: 'doc-item doc-item--card' });
      row.appendChild(el('span', { class: 'doc-item-num' }, 'Etapa ' + (i + 1)));
      var titulo = el('input', { type: 'text', maxlength: '60', 'data-item': 'proceso', 'data-index': i, 'data-prop': 'titulo', 'aria-label': 'Nombre de la etapa ' + (i + 1) });
      titulo.value = etapa.titulo;
      var texto = el('textarea', { rows: '2', maxlength: '500', 'data-item': 'proceso', 'data-index': i, 'data-prop': 'texto', 'aria-label': 'Descripción de la etapa ' + (i + 1) });
      texto.value = etapa.texto;
      row.appendChild(titulo);
      row.appendChild(texto);
      cont.appendChild(row);
    });
  }

  function enfocarItem(nombre, i) {
    var n = form.querySelector('[data-item="' + nombre + '"][data-index="' + i + '"]');
    if (n) n.focus();
  }

  function agregar(nombre, despues) {
    var nuevo = nombre === 'funcionalidades' ? { nombre: '', descripcion: '' } : '';
    var i = despues == null ? estado[nombre].length : despues + 1;
    estado[nombre].splice(i, 0, nuevo);
    renderLista(nombre);
    form.querySelector('[data-lista="' + nombre + '"]').removeAttribute('aria-invalid');
    enfocarItem(nombre, i);
    marcarSucio();
  }

  form.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !estado) return;
    if (t.hasAttribute('data-agregar')) { agregar(t.getAttribute('data-agregar')); return; }
    if (t.id === 'doc-proceso-reset') {
      if (window.confirm('¿Restaurar el nombre y el texto original de las 5 etapas?')) {
        estado.proceso = M.TEXTOS.proceso.map(function (p) { return { titulo: p.titulo, texto: p.texto }; });
        renderProceso();
        marcarSucio();
      }
      return;
    }
    var row = t.closest('.doc-item');
    var cont = t.closest('[data-lista]');
    if (!row || !cont) return;
    var nombre = cont.getAttribute('data-lista');
    var i = Number(row.getAttribute('data-index'));
    var items = estado[nombre];
    if (t.hasAttribute('data-quitar')) {
      items.splice(i, 1);
      renderLista(nombre);
      var foco = cont.querySelectorAll('.doc-item')[Math.min(i, items.length - 1)];
      (foco ? foco.querySelector('input') : cont.nextElementSibling).focus();
    } else if (t.hasAttribute('data-mover')) {
      var j = i + Number(t.getAttribute('data-mover'));
      if (j < 0 || j >= items.length) return;
      var tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
      renderLista(nombre);
      var mover = cont.querySelectorAll('.doc-item')[j].querySelector('[data-mover="' + t.getAttribute('data-mover') + '"]');
      (mover && !mover.disabled ? mover : cont.querySelectorAll('.doc-item')[j].querySelector('input')).focus();
    } else {
      return;
    }
    marcarSucio();
  });

  // Enter en un elemento de lista agrega otro debajo (cómodo en el celular).
  form.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key !== 'Enter' || t.tagName !== 'INPUT' || e.isComposing) return;
    e.preventDefault();
    var lista = t.getAttribute('data-item');
    if (lista && LISTAS[lista]) agregar(lista, Number(t.getAttribute('data-index')));
  });

  /* ---------- Pasos ---------- */
  var paneles = editor.querySelectorAll('.doc-panel');

  function irA(n) {
    paso = n;
    paneles.forEach(function (p) { p.hidden = Number(p.getAttribute('data-paso')) !== n; });
    editor.querySelectorAll('.doc-steps [data-ir]').forEach(function (b) {
      var k = Number(b.getAttribute('data-ir'));
      if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', k < n);
    });
    $('doc-prev').hidden = n === 1;
    $('doc-next').hidden = n === 4;
    $('doc-next').textContent = n === 2 ? 'Ver vista previa' : (n === 3 ? 'Ir a descargar' : 'Siguiente');
    if (n === 3) renderPreview();
    if (n === 4) {
      document.querySelectorAll('[data-archivo]').forEach(function (s) { s.textContent = M.nombreArchivo(estado, s.getAttribute('data-archivo')); });
    }
    var top = editor.getBoundingClientRect().top + window.pageYOffset - 80;
    if (window.pageYOffset > top) window.scrollTo(0, top);
  }

  editor.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (!b) return;
    ocultarErrores();
    irA(Number(b.getAttribute('data-ir')));
  });

  $('doc-next').addEventListener('click', function () {
    if (paso <= 2) {
      var errores = M.validar(estado, paso);
      if (errores.length) { mostrarErrores(errores); return; }
    }
    ocultarErrores();
    irA(paso + 1);
    $('doc-p' + paso).focus();
  });
  $('doc-prev').addEventListener('click', function () {
    ocultarErrores();
    irA(paso - 1);
    $('doc-p' + paso).focus();
  });
  [1, 2, 3, 4].forEach(function (n) { $('doc-p' + n).setAttribute('tabindex', '-1'); });

  /* ---------- Errores ---------- */
  function nodoDe(error) {
    var partes = error.campo.split('.');
    if (partes.length === 2) {
      var prop = partes[0] === 'proceso' ? 'titulo' : 'nombre';
      return form.querySelector('[data-item="' + partes[0] + '"][data-index="' + partes[1] + '"][data-prop="' + prop + '"]');
    }
    var lista = form.querySelector('[data-lista="' + error.campo + '"]');
    if (lista) return lista;
    var c = campo(error.campo);
    return c && c.length && !c.tagName ? c[0] : c;
  }

  function mostrarErrores(errores) {
    var box = $('doc-errors');
    var ul = $('doc-errors-list');
    ul.innerHTML = '';
    form.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    errores.forEach(function (err) {
      var nodo = nodoDe(err);
      if (nodo) nodo.setAttribute('aria-invalid', 'true');
      var li = el('li');
      var b = el('button', { type: 'button', class: 'doc-error-link' }, err.mensaje);
      b.addEventListener('click', function () {
        if (paso !== err.paso) irA(err.paso);
        var n = nodoDe(err);
        if (!n) return;
        var foco = n.matches('input, textarea, select') ? n : (n.querySelector('input, textarea') || n.nextElementSibling);
        if (foco) {
          foco.focus();
          if (foco.scrollIntoView) foco.scrollIntoView({ block: 'center' });
        }
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    box.hidden = false;
    box.focus();
    box.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -90);
  }

  function ocultarErrores() { $('doc-errors').hidden = true; }

  /* ---------- Vista previa ---------- */
  function renderPreview() {
    var paper = $('doc-preview');
    paper.innerHTML = '';
    var est = M.estudio();
    paper.appendChild(A.html(M.construir(estado, est, { preview: true }), est));
    var pie = el('p', { class: 'dp-footer' });
    pie.appendChild(el('span', null, M.construir(estado, est).pie));
    pie.appendChild(el('span', null, 'Página 1 de N'));
    paper.appendChild(pie);
  }

  /* ---------- Generar archivos ---------- */
  function generar(formato) {
    if (!estado || ocupado) return;
    var errores = M.validar(estado);
    if (errores.length) {
      if (paso > 2) irA(errores[0].paso);
      mostrarErrores(errores);
      return;
    }
    ocultarErrores();
    var est = M.estudio();
    var doc = M.construir(estado, est);
    var nombre = M.nombreArchivo(estado, formato);
    var botones = editor.querySelectorAll('[data-generar]');
    ocupado = true;
    botones.forEach(function (b) { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
    mostrarGuardado(formato === 'pdf' ? 'Generando PDF…' : 'Generando Word…');

    (formato === 'pdf' ? A.pdf(doc, est) : A.docx(doc, est)).then(function (blob) {
      liberarArchivo();
      ultimaUrl = A.descargar(blob, nombre);
      if (docEstado === 'borrador') {
        docEstado = 'generado';
        $('doc-estado').value = docEstado;
      }
      marcarSucio();
      return (db ? guardar(true) : Promise.reject(new Error('sin conexión con Firebase'))).then(
        function () { resultado(true, nombre); },
        function (err) { resultado(true, nombre, err); });
    }).catch(function (err) {
      mostrarGuardado('');
      resultado(false, nombre, err);
    }).then(function () {
      ocupado = false;
      botones.forEach(function (b) { b.disabled = false; b.removeAttribute('aria-busy'); });
    });
  }

  function resultado(ok, nombre, err) {
    if (paso !== 4) irA(4);
    var box = $('doc-result');
    box.innerHTML = '';
    box.className = 'form-status ' + (ok ? 'is-ok' : 'is-error');
    if (ok) {
      box.appendChild(el('h3', null, '✅ Archivo generado'));
      box.appendChild(el('p', null, 'Se descargó «' + nombre + '». Si no lo ves, revisa la carpeta Descargas de tu celular o computador.'));
      if (ultimaUrl) {
        var again = el('p', { class: 'doc-again' });
        again.appendChild(el('a', { href: ultimaUrl, download: nombre, class: 'btn btn-ghost btn-sm' }, '⬇️ Descargar de nuevo'));
        box.appendChild(again);
      }
      box.appendChild(el('p', null, err
        ? '⚠️ No se pudo guardar en Documentos recientes: ' + err.message
        : 'También quedó guardado en Documentos recientes.'));
    } else {
      box.appendChild(el('h3', null, 'No se pudo generar el archivo'));
      box.appendChild(el('p', null, (err && err.message) || 'Error desconocido. Inténtalo de nuevo.'));
    }
    box.hidden = false;
    box.focus();
  }

  editor.addEventListener('click', function (e) {
    var b = e.target.closest('[data-generar]');
    if (b) generar(b.getAttribute('data-generar'));
  });

  /* ---------- Guardar y eliminar borrador ---------- */
  $('doc-guardar').addEventListener('click', function () {
    if (!estado) return;
    var b = $('doc-guardar');
    b.disabled = true;
    guardar(false).catch(function (err) {
      window.alert('No se pudo guardar el borrador. ' + err.message);
      mostrarGuardado();
    }).then(function () { b.disabled = false; });
  });

  $('doc-eliminar').addEventListener('click', function () {
    if (!docId || !existe) return;
    var nombres = M.NOMBRES[estado.tipo];
    eliminarDoc(docId, nombres.corto.toLowerCase() + ' N.º ' + txt(estado.numero) + ' de ' + (txt(estado.cliente) || 'sin cliente'));
  });

  window.FuncodeDocs = { iniciar: iniciar, detener: detener, desdeSolicitud: desdeSolicitud };
})();
