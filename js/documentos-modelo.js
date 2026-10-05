/*
 * Funcode Studio CB — contenido de las cotizaciones y propuestas.
 * Sigue las plantillas oficiales: mismas secciones, mismo orden y mismos textos fijos.
 * El documento se describe como una lista de bloques que luego se dibuja en la vista
 * previa (HTML), en Word (.docx) y en PDF (ver documentos-archivos.js).
 */
(function () {
  'use strict';

  var TIPOS_PROYECTO = ['Página web', 'Landing page', 'Aplicación web', 'Plataforma educativa',
    'Mejora de proyecto existente', 'Otro'];

  var NOMBRES = {
    cotizacion: { titulo: 'Cotización de proyecto', corto: 'Cotización', numero: 'Cotización N.º', archivo: 'Cotizacion' },
    propuesta: { titulo: 'Propuesta de solución digital', corto: 'Propuesta', numero: 'Propuesta N.º', archivo: 'Propuesta' }
  };

  // Textos de las plantillas que se pueden editar en cada documento.
  var TEXTOS = {
    cambios: 'Durante el desarrollo se pueden solicitar ajustes relacionados con el alcance acordado.\n\n' +
      'Los cambios que impliquen nuevas funcionalidades, modificaciones importantes o ampliaciones del proyecto ' +
      'podrán generar un costo adicional, previamente informado al cliente.',
    condiciones: '- El cliente debe proporcionar la información y materiales necesarios para el proyecto.\n' +
      '- El alcance final será el acordado antes de comenzar.\n' +
      '- Si Funcode Studio CB identifica una solicitud que no puede realizar, será comunicada directamente antes de iniciar dicha funcionalidad.\n' +
      '- Los precios mostrados son específicos para este proyecto y pueden variar según sus requisitos.',
    proximoPaso: 'Si la propuesta es de tu interés, el siguiente paso será confirmar:\n' +
      '- Alcance definitivo.\n- Precio final.\n- Tiempo de desarrollo.\n- Forma de pago.\n- Condiciones del proyecto.\n\n' +
      'Una vez acordados estos puntos, podremos comenzar.',
    proceso: [
      { titulo: 'Requisitos', texto: 'Conversamos sobre la idea y definimos qué necesita el proyecto.' },
      { titulo: 'Propuesta', texto: 'Se establece el alcance, precio y tiempo estimado.' },
      { titulo: 'Desarrollo', texto: 'Se comienza la construcción de la solución.' },
      { titulo: 'Revisión', texto: 'El cliente revisa el avance y comunica los ajustes relacionados con el alcance acordado.' },
      { titulo: 'Entrega', texto: 'Se realiza la entrega final del proyecto.' }
    ]
  };

  // Compromiso de Funcode Studio CB: texto fijo de la plantilla de propuesta (no se edita).
  var COMPROMISO = [
    'Buscamos trabajar de manera clara y directa.',
    'Si existe una funcionalidad que no podamos realizar, lo diremos desde el principio.',
    'No prometemos algo simplemente para conseguir un proyecto. Preferimos explicar las limitaciones, buscar ' +
      'alternativas cuando sea posible y llegar a acuerdos claros con cada cliente.'
  ];

  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function nuevo(tipo, numero) {
    return {
      tipo: tipo === 'propuesta' ? 'propuesta' : 'cotizacion',
      numero: numero || '001',
      fecha: hoy(),
      cliente: '', telefono: '', correo: '',
      proyecto: '', tipoProyecto: 'Página web', tipoOtro: '',
      valor: '', tiempo: '',
      // Cotización
      descripcion: '',
      alcance: ['Diseño adaptable a celulares y computadores.'],
      formaPago: '',
      cambios: TEXTOS.cambios,
      condiciones: TEXTOS.condiciones,
      vigencia: 15,
      // Propuesta
      problema: '', solucionNombre: '', solucion: '',
      funcionalidades: [{ nombre: '', descripcion: '' }],
      diseno: ['Diseño adaptable a diferentes dispositivos.', 'Interfaz clara y funcional.'],
      incluye: [''],
      noIncluye: [''],
      proceso: TEXTOS.proceso.map(function (p) { return { titulo: p.titulo, texto: p.texto }; }),
      proximoPaso: TEXTOS.proximoPaso,
      solicitudId: ''
    };
  }

  // Completa datos guardados con versiones anteriores del generador.
  function completar(datos) {
    var base = nuevo(datos && datos.tipo);
    Object.keys(base).forEach(function (k) {
      if (datos && datos[k] != null && typeof datos[k] === typeof base[k] && Array.isArray(datos[k]) === Array.isArray(base[k])) {
        base[k] = datos[k];
      }
    });
    return base;
  }

  /* ---------- Formatos ---------- */
  function txt(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function lineas(v) { return String(v == null ? '' : v).replace(/\r\n?/g, '\n').trim(); }
  function digitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  function dinero(valor) {
    var n = digitos(valor).replace(/^0+(?=\d)/, '');
    return n ? '$' + n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' COP' : '';
  }

  function fechaCorta(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  function telefonoVisible(numero) {
    var d = digitos(numero);
    if (d.length === 12 && d.indexOf('57') === 0) return '+57 ' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8);
    return d ? '+' + d : '';
  }

  function sitioVisible(url) { return txt(url).replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  function quitarTildes(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function numeroArchivo(numero) {
    var n = quitarTildes(txt(numero)).replace(/[^A-Za-z0-9-]/g, '');
    if (/^\d+$/.test(n)) n = n.padStart(3, '0');
    return n.slice(0, 20) || '000';
  }

  // «Ana María Pérez» → «AnaMariaPerez». Solo letras y números: válido en Windows, Mac y celulares.
  function nombreArchivo(d, ext) {
    var cliente = quitarTildes(txt(d.cliente)).split(/[^A-Za-z0-9]+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('').slice(0, 40) || 'Cliente';
    return NOMBRES[d.tipo].archivo + '_Funcode_' + numeroArchivo(d.numero) + '_' + cliente + '.' + ext;
  }

  function tipoProyecto(d) {
    return d.tipoProyecto === 'Otro' ? (txt(d.tipoOtro) ? 'Otro: ' + txt(d.tipoOtro) : 'Otro') : d.tipoProyecto;
  }

  function limpiarLista(lista) {
    return (lista || []).map(txt).filter(Boolean);
  }

  /* ---------- Validación ---------- */
  var CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

  // Devuelve [{ campo, paso, mensaje }]. paso: 1 = Datos, 2 = Contenido.
  function validar(d, soloPaso) {
    var errores = [];
    function falta(campo, paso, mensaje) {
      if (!soloPaso || soloPaso === paso) errores.push({ campo: campo, paso: paso, mensaje: mensaje });
    }
    var cot = d.tipo === 'cotizacion';

    if (!txt(d.numero)) falta('numero', 1, 'Falta el número del documento.');
    if (!fechaCorta(d.fecha)) falta('fecha', 1, 'Falta la fecha del documento.');
    if (!txt(d.cliente)) falta('cliente', 1, 'Falta el nombre del cliente.');
    var tel = txt(d.telefono);
    if (tel && (!/^\+?[\d\s().-]+$/.test(tel) || digitos(tel).length < 7 || digitos(tel).length > 15)) {
      falta('telefono', 1, 'El teléfono no parece válido. Usa solo números, por ejemplo 320 292 0181.');
    }
    var correo = txt(d.correo);
    if (correo && !CORREO.test(correo)) falta('correo', 1, 'El correo no parece válido. Revisa que tenga @ y un dominio, por ejemplo nombre@gmail.com.');
    if (!txt(d.proyecto)) falta('proyecto', 1, 'Falta el nombre del proyecto.');
    if (TIPOS_PROYECTO.indexOf(d.tipoProyecto) === -1) falta('tipoProyecto', 1, 'Elige el tipo de proyecto.');
    if (d.tipoProyecto === 'Otro' && !txt(d.tipoOtro)) falta('tipoOtro', 1, 'Escribe cuál es el tipo de proyecto (elegiste «Otro»).');

    if (cot) {
      if (!lineas(d.descripcion)) falta('descripcion', 2, 'Falta la descripción del proyecto.');
      if (!limpiarLista(d.alcance).length) falta('alcance', 2, 'Agrega al menos un elemento al alcance incluido.');
    } else {
      if (!lineas(d.problema)) falta('problema', 2, 'Falta el problema o necesidad del cliente.');
      if (!lineas(d.solucion)) falta('solucion', 2, 'Falta explicar la solución propuesta.');
      var funcs = (d.funcionalidades || []).filter(function (f) { return txt(f.nombre) || lineas(f.descripcion); });
      if (!funcs.length) falta('funcionalidades', 2, 'Agrega al menos una funcionalidad a la solución propuesta.');
      (d.funcionalidades || []).forEach(function (f, i) {
        if (!txt(f.nombre) && lineas(f.descripcion)) falta('funcionalidades.' + i, 2, 'La funcionalidad ' + (i + 1) + ' no tiene nombre.');
      });
      if (!limpiarLista(d.incluye).length) falta('incluye', 2, 'Agrega al menos un elemento a «Incluye».');
    }

    if (!digitos(d.valor) || !/[1-9]/.test(digitos(d.valor))) {
      falta('valor', 2, cot ? 'Falta el valor del proyecto.' : 'Falta el valor estimado.');
    }
    if (cot && !txt(d.formaPago)) falta('formaPago', 2, 'Falta la forma de pago.');
    if (!txt(d.tiempo)) falta('tiempo', 2, 'Falta el tiempo estimado de desarrollo.');

    if (cot) {
      if (!lineas(d.cambios)) falta('cambios', 2, 'Falta el texto de «Cambios y ajustes».');
      var dias = Number(d.vigencia);
      if (!(dias >= 1 && dias <= 365 && Math.floor(dias) === dias)) falta('vigencia', 2, 'La vigencia debe ser un número de días entre 1 y 365.');
    } else {
      (d.proceso || []).forEach(function (p, i) {
        if (!txt(p.titulo)) falta('proceso.' + i, 2, 'La etapa ' + (i + 1) + ' del proceso no tiene nombre.');
      });
      if (!lineas(d.proximoPaso)) falta('proximoPaso', 2, 'Falta el texto de «Próximo paso».');
    }
    return errores;
  }

  /* ---------- Bloques del documento ---------- */
  // Un «run» es un trozo de texto con formato: { text, bold, italic, missing }.
  // missing solo aparece en la vista previa para marcar lo que falta llenar.

  function construir(d, estudio, opciones) {
    var preview = !!(opciones && opciones.preview);
    var b = [];
    var cot = d.tipo === 'cotizacion';
    var nombres = NOMBRES[d.tipo];

    function v(valor, etiqueta) {
      if (valor) return { text: valor };
      return preview ? { text: '[' + etiqueta + ']', missing: true } : { text: '' };
    }
    function p(runs, extra) {
      var block = { type: 'p', runs: runs.filter(function (r) { return r && r.text; }) };
      Object.keys(extra || {}).forEach(function (k) { block[k] = extra[k]; });
      if (block.runs.length) b.push(block);
    }
    function etiqueta(label, run) { p([{ text: label + ': ', bold: true }, run]); }
    function h1(text) { b.push({ type: 'h1', text: text }); }
    function h2(text) { b.push({ type: 'h2', text: text }); }
    function lista(items, falta) {
      var limpios = limpiarLista(items);
      if (limpios.length) b.push({ type: 'list', items: limpios });
      else if (preview && falta) p([{ text: '[' + falta + ']', missing: true }]);
    }
    function texto(valor, falta) {
      var t = lineas(valor);
      if (!t) {
        if (preview && falta) p([{ text: '[' + falta + ']', missing: true }]);
        return [];
      }
      var bloques = [];
      var actual = null;
      t.split('\n').forEach(function (linea) {
        var l = linea.trim();
        if (!l) { actual = null; return; }
        var item = /^[-•*–]\s*(.+)$/.exec(l);
        if (item) {
          if (!actual) { actual = { type: 'list', items: [] }; bloques.push(actual); }
          actual.items.push(item[1].trim());
        } else {
          actual = null;
          bloques.push({ type: 'p', runs: [{ text: l }] });
        }
      });
      bloques.forEach(function (x) { b.push(x); });
      return bloques;
    }

    var cliente = txt(d.cliente);
    var proyecto = txt(d.proyecto);
    var valor = dinero(d.valor);
    var fecha = fechaCorta(d.fecha);
    var numero = txt(d.numero);

    b.push({ type: 'brand', text: 'FUNCODE STUDIO CB' });
    b.push({ type: 'title', text: nombres.titulo });

    var meta = [];
    if (cot) {
      meta.push(['Fecha', v(fecha, 'Fecha')]);
      meta.push([nombres.numero, v(numero, 'Número')]);
      meta.push(['Cliente', v(cliente, 'Nombre del cliente')]);
      var contacto = [txt(d.telefono), txt(d.correo)].filter(Boolean).join(' / ');
      if (contacto) meta.push(['Contacto', { text: contacto }]);
    } else {
      meta.push(['Preparada para', v(cliente, 'Nombre del cliente')]);
      meta.push(['Proyecto', v(proyecto, 'Nombre del proyecto')]);
      meta.push(['Fecha', v(fecha, 'Fecha')]);
      meta.push([nombres.numero, v(numero, 'Número')]);
    }
    b.push({ type: 'meta', rows: meta.map(function (r) { return { label: r[0], run: r[1] }; }) });

    if (cot) {
      h1('1. Proyecto');
      etiqueta('Nombre del proyecto', v(proyecto, 'Nombre del proyecto'));
      p([{ text: 'Tipo de proyecto:', bold: true }]);
      b.push({
        type: 'checks',
        items: TIPOS_PROYECTO.map(function (t) {
          var on = d.tipoProyecto === t;
          var label = t === 'Otro' && on ? tipoProyecto(d) : t;
          return { text: label, on: on };
        })
      });
      h2('Descripción');
      texto(d.descripcion, 'Descripción del proyecto');

      h1('2. Alcance incluido');
      p([{ text: 'El proyecto incluye:' }]);
      lista(d.alcance, 'Elementos del alcance');

      h1('3. Inversión');
      etiqueta('Valor del proyecto', v(valor, 'Valor'));
      etiqueta('Forma de pago', v(txt(d.formaPago), 'Forma de pago'));
      p([{ text: 'El valor corresponde al alcance descrito en esta cotización. Cualquier funcionalidad adicional o cambio importante en los requerimientos podrá ser cotizado por separado.' }]);

      h1('4. Tiempo estimado');
      etiqueta('Tiempo estimado de desarrollo', v(txt(d.tiempo), 'Tiempo'));
      p([{ text: 'El tiempo comienza a contar una vez se hayan recibido los materiales e información necesarios para iniciar el proyecto.' }]);

      h1('5. Cambios y ajustes');
      texto(d.cambios, 'Cambios y ajustes');

      h1('6. Condiciones básicas');
      var dias = Number(d.vigencia);
      var vigencia = dias >= 1 ? 'La cotización tiene una vigencia de ' + dias + (dias === 1 ? ' día.' : ' días.') : '';
      var condiciones = texto(d.condiciones);
      var ultima = condiciones[condiciones.length - 1];
      if (vigencia) {
        if (ultima && ultima.type === 'list') ultima.items.push(vigencia);
        else b.push({ type: 'list', items: [vigencia] });
      } else if (preview) {
        p([{ text: '[Vigencia en días]', missing: true }]);
      }

      h1('7. Aceptación');
      b.push({
        type: 'sign',
        cols: [
          { title: 'Cliente', lines: cliente ? [cliente] : [], date: true },
          { title: estudio.nombre, lines: [estudio.fundador, estudio.cargo].filter(Boolean) }
        ],
        // Va dentro del bloque para que no quede separado de las firmas en otra página.
        total: { label: 'Valor acordado', run: v(valor, 'Valor') }
      });

      var contactos = [
        estudio.whatsapp ? 'WhatsApp ' + telefonoVisible(estudio.whatsapp) : '',
        estudio.email || '',
        sitioVisible(estudio.sitio)
      ].filter(Boolean).join(' · ');
      b.push({
        type: 'closing',
        lines: [
          { text: 'FUNCODE STUDIO CB', bold: true, big: true },
          estudio.lema ? { text: estudio.lema, italic: true } : null,
          contactos ? { text: contactos, small: true } : null
        ].filter(Boolean)
      });
    } else {
      h1('1. Sobre el proyecto');
      p([v(cliente, 'Nombre del cliente'), { text: ' busca una solución que permita:' }]);
      texto(d.problema, 'Problema o necesidad del cliente');
      p([{ text: 'A partir de esta necesidad, Funcode Studio CB propone desarrollar:' }]);
      var solucion = v(txt(d.solucionNombre) || proyecto, 'Nombre de la solución');
      solucion.bold = true;
      p([solucion], { strong: true });
      texto(d.solucion, 'Explicación de la solución');

      h1('2. Solución propuesta');
      p([{ text: 'La solución estará compuesta por:' }]);
      var funcs = (d.funcionalidades || []).filter(function (f) { return txt(f.nombre) || lineas(f.descripcion); });
      if (!funcs.length && preview) p([{ text: '[Funcionalidades]', missing: true }]);
      funcs.forEach(function (f) {
        if (txt(f.nombre)) h2(txt(f.nombre));
        else if (preview) p([{ text: '[Nombre de la funcionalidad]', missing: true }]);
        texto(f.descripcion);
      });
      if (limpiarLista(d.diseno).length) {
        h2('Diseño y experiencia');
        lista(d.diseno);
      }

      h1('3. Alcance del proyecto');
      h2('Incluye');
      lista(d.incluye, 'Elementos incluidos');
      if (limpiarLista(d.noIncluye).length) {
        h2('No incluye');
        lista(d.noIncluye);
      }
      p([{ text: 'Si durante el desarrollo aparece una necesidad que esté fuera del alcance inicial, será informada y cotizada antes de realizarse.' }]);

      h1('4. Inversión');
      h2('Valor estimado');
      p([v(valor, 'Valor estimado')], { amount: true });
      p([{ text: 'Este valor corresponde al alcance descrito en esta propuesta.' }]);
      p([{ text: 'El precio definitivo será confirmado antes de comenzar el desarrollo.' }]);

      h1('5. Tiempo estimado');
      etiqueta('Desarrollo estimado', v(txt(d.tiempo), 'Tiempo'));
      p([{ text: 'El tiempo puede variar dependiendo de la complejidad del proyecto, disponibilidad de información y comentarios del cliente.' }]);

      h1('6. Proceso de trabajo');
      (d.proceso || []).forEach(function (etapa, i) {
        h2((i + 1) + '. ' + (txt(etapa.titulo) || (preview ? '[Nombre de la etapa]' : '')));
        texto(etapa.texto);
      });

      h1('7. Compromiso de Funcode Studio CB');
      COMPROMISO.forEach(function (t) { p([{ text: t }]); });

      h1('8. Próximo paso');
      texto(d.proximoPaso, 'Próximo paso');

      b.push({
        type: 'closing',
        lines: [
          { text: 'FUNCODE STUDIO CB', bold: true, big: true },
          estudio.firma ? { text: estudio.firma, bold: true } : null,
          estudio.cargo ? { text: estudio.cargo } : null,
          estudio.sitio ? { text: 'Página: ' + sitioVisible(estudio.sitio), small: true } : null,
          estudio.whatsapp ? { text: 'WhatsApp: ' + telefonoVisible(estudio.whatsapp), small: true } : null,
          estudio.email ? { text: 'Correo: ' + estudio.email, small: true } : null,
          estudio.frase ? { text: '«' + estudio.frase + '»', italic: true, quote: true } : null
        ].filter(Boolean)
      });
    }

    return {
      titulo: nombres.titulo,
      pie: nombres.numero + ' ' + (numero || '') + ' · ' + (estudio.nombre || 'Funcode Studio CB'),
      asunto: nombres.corto + ' para ' + cliente + (proyecto ? ' — ' + proyecto : ''),
      bloques: b
    };
  }

  // Datos fijos del estudio: se leen de js/config.js (un solo lugar).
  function estudio() {
    var c = window.FUNCODE_CONFIG || {};
    var e = c.estudio || {};
    return {
      nombre: e.nombre || 'Funcode Studio CB',
      fundador: e.fundador || '',
      firma: e.firma || e.fundador || '',
      cargo: e.cargo || '',
      sitio: e.sitio || '',
      lema: e.lema || '',
      frase: e.frase || '',
      whatsapp: c.whatsapp || '',
      email: c.email || '',
      logo: e.logo || 'assets/icons/icon-192.png'
    };
  }

  window.FuncodeDocModelo = {
    TIPOS_PROYECTO: TIPOS_PROYECTO,
    NOMBRES: NOMBRES,
    TEXTOS: TEXTOS,
    COMPROMISO: COMPROMISO,
    nuevo: nuevo,
    completar: completar,
    validar: validar,
    construir: construir,
    estudio: estudio,
    nombreArchivo: nombreArchivo,
    dinero: dinero,
    digitos: digitos,
    fechaCorta: fechaCorta,
    hoy: hoy
  };
})();
