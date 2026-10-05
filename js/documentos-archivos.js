/*
 * Funcode Studio CB — convierte los bloques de un documento (documentos-modelo.js) en:
 *   - Vista previa HTML.
 *   - Word (.docx): se arma aquí mismo (XML de Office + ZIP), sin librerías.
 *   - PDF: con jsPDF (assets/vendor/jspdf), que se carga solo al generar el primer PDF.
 * Todo ocurre en el navegador: los datos del cliente no se envían a ningún servicio.
 */
(function () {
  'use strict';

  var COLOR = { navy: '0B1F44', blue: '2F6BFF', text: '1F2937', muted: '5B6475', soft: 'F2F5FB', gold: 'F2C14E', line: 'C9D3E6' };
  var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  /* ======================================================================
     Vista previa (HTML)
     ====================================================================== */
  function runsHtml(parent, runs) {
    runs.forEach(function (r) {
      var node;
      if (r.missing) node = document.createElement('mark');
      else if (r.bold && r.italic) { node = document.createElement('strong'); node.appendChild(document.createElement('em')); }
      else if (r.bold) node = document.createElement('strong');
      else if (r.italic) node = document.createElement('em');
      else { parent.appendChild(document.createTextNode(r.text)); return; }
      (node.firstChild || node).textContent = r.text;
      parent.appendChild(node);
    });
  }

  function html(doc, estudio) {
    var root = document.createDocumentFragment();
    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    doc.bloques.forEach(function (b) {
      if (b.type === 'brand') {
        var brand = el('div', 'dp-brand');
        var img = el('img');
        img.src = estudio.logo; img.alt = ''; img.width = 40; img.height = 40;
        brand.appendChild(img);
        brand.appendChild(el('span', null, b.text));
        root.appendChild(brand);
      } else if (b.type === 'title') {
        root.appendChild(el('h1', 'dp-title', b.text));
      } else if (b.type === 'meta') {
        var dl = el('dl', 'dp-meta');
        b.rows.forEach(function (r) {
          var row = el('div');
          row.appendChild(el('dt', null, r.label + ':'));
          var dd = el('dd');
          runsHtml(dd, [r.run]);
          row.appendChild(dd);
          dl.appendChild(row);
        });
        root.appendChild(dl);
      } else if (b.type === 'h1') {
        root.appendChild(el('h2', 'dp-h1', b.text));
      } else if (b.type === 'h2') {
        root.appendChild(el('h3', 'dp-h2', b.text));
      } else if (b.type === 'p') {
        var p = el('p', b.amount ? 'dp-amount' : (b.strong ? 'dp-strong' : null));
        runsHtml(p, b.runs);
        root.appendChild(p);
      } else if (b.type === 'list') {
        var ul = el('ul', 'dp-list');
        b.items.forEach(function (i) { ul.appendChild(el('li', null, i)); });
        root.appendChild(ul);
      } else if (b.type === 'checks') {
        var checks = el('ul', 'dp-checks');
        b.items.forEach(function (i) {
          var li = el('li', i.on ? 'is-on' : null);
          li.appendChild(el('span', 'dp-box', i.on ? '✓' : ''));
          li.appendChild(document.createTextNode(i.text));
          li.setAttribute('aria-label', (i.on ? 'Marcado: ' : 'Sin marcar: ') + i.text);
          checks.appendChild(li);
        });
        root.appendChild(checks);
      } else if (b.type === 'sign') {
        var sign = el('div', 'dp-sign');
        b.cols.forEach(function (c) {
          var col = el('div');
          col.appendChild(el('p', 'dp-sign-title', c.title));
          col.appendChild(el('div', 'dp-sign-line'));
          col.appendChild(el('p', 'dp-sign-caption', 'Firma'));
          c.lines.forEach(function (l) { col.appendChild(el('p', 'dp-sign-name', l)); });
          if (c.date) col.appendChild(el('p', 'dp-sign-name', 'Fecha: ____________________'));
          sign.appendChild(col);
        });
        root.appendChild(sign);
        if (b.total) {
          var total = el('p');
          runsHtml(total, [{ text: b.total.label + ': ', bold: true }, b.total.run]);
          root.appendChild(total);
        }
      } else if (b.type === 'closing') {
        var close = el('footer', 'dp-closing');
        b.lines.forEach(function (l) {
          close.appendChild(el('p', [l.big ? 'is-big' : '', l.small ? 'is-small' : '', l.bold ? 'is-bold' : '', l.italic ? 'is-italic' : '']
            .filter(Boolean).join(' '), l.text));
        });
        root.appendChild(close);
      }
    });
    return root;
  }

  /* ======================================================================
     ZIP (método «store», sin compresión: Word lo abre sin problema)
     ====================================================================== */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files, mime) {
    var enc = new TextEncoder();
    var parts = [];
    var central = [];
    var offset = 0;
    var now = new Date();
    var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    files.forEach(function (f) {
      var name = enc.encode(f.name);
      var data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      var crc = crc32(data);

      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // nombres en UTF-8
      local.setUint16(8, 0, true);      // sin compresión
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      var entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(8, 0x0800, true);
      entry.setUint16(10, 0, true);
      entry.setUint16(12, time, true);
      entry.setUint16(14, date, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, data.length, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), name);

      offset += 30 + name.length + data.length;
    });

    var size = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: mime });
  }

  /* ======================================================================
     Word (.docx)
     ====================================================================== */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function wRun(text, o) {
    o = o || {};
    var rPr = '';
    if (o.font) rPr += '<w:rFonts w:ascii="' + o.font + '" w:hAnsi="' + o.font + '" w:eastAsia="' + o.font + '" w:cs="' + o.font + '"/>';
    if (o.bold) rPr += '<w:b/><w:bCs/>';
    if (o.italic) rPr += '<w:i/><w:iCs/>';
    if (o.color) rPr += '<w:color w:val="' + o.color + '"/>';
    if (o.spacing) rPr += '<w:spacing w:val="' + o.spacing + '"/>';
    if (o.size) rPr += '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>';
    return '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
  }

  function wRuns(runs, base) {
    return runs.map(function (r) {
      return wRun(r.text, { bold: r.bold || (base && base.bold), italic: r.italic, color: base && base.color, size: base && base.size });
    }).join('');
  }

  function wPara(content, o) {
    o = o || {};
    var pPr = '';
    if (o.style) pPr += '<w:pStyle w:val="' + o.style + '"/>';
    if (o.keepNext) pPr += '<w:keepNext/>';
    if (o.num) pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
    if (o.border) pPr += '<w:pBdr><w:' + o.border.side + ' w:val="single" w:sz="' + (o.border.size || 6) + '" w:space="' + (o.border.space || 4) + '" w:color="' + o.border.color + '"/></w:pBdr>';
    if (o.spacing) pPr += '<w:spacing w:before="' + (o.spacing[0] || 0) + '" w:after="' + (o.spacing[1] || 0) + '"/>';
    if (o.ind) pPr += '<w:ind w:left="' + o.ind + '"/>';
    if (o.align) pPr += '<w:jc w:val="' + o.align + '"/>';
    return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + content + '</w:p>';
  }

  var NO_BORDERS = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';

  function wTable(widths, cells, o) {
    o = o || {};
    var grid = widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('');
    var row = cells.map(function (c, i) {
      var tcPr = '<w:tcW w:w="' + widths[i] + '" w:type="dxa"/>';
      // Word exige este orden: tcW, tcBorders, shd, vAlign.
      if (o.leftBar) tcPr += '<w:tcBorders><w:left w:val="single" w:sz="24" w:space="0" w:color="' + o.leftBar + '"/></w:tcBorders>';
      if (o.shade) tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shade + '"/>';
      if (o.vAlign) tcPr += '<w:vAlign w:val="' + o.vAlign + '"/>';
      return '<w:tc><w:tcPr>' + tcPr + '</w:tcPr>' + c + '</w:tc>';
    }).join('');
    var margins = o.pad != null
      ? '<w:tblCellMar><w:top w:w="' + o.pad + '" w:type="dxa"/><w:left w:w="' + (o.padX || o.pad) + '" w:type="dxa"/><w:bottom w:w="' + o.pad + '" w:type="dxa"/><w:right w:w="' + (o.padX || o.pad) + '" w:type="dxa"/></w:tblCellMar>'
      : '';
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    // Fila extra a todo lo ancho (por ejemplo, «Valor acordado» debajo de las firmas).
    var extra = o.extraRow
      ? '<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="' + total + '" w:type="dxa"/><w:gridSpan w:val="' + widths.length + '"/></w:tcPr>' + o.extraRow + '</w:tc></w:tr>'
      : '';
    return '<w:tbl><w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/>' + NO_BORDERS + '<w:tblLayout w:type="fixed"/>' + margins +
      '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>' +
      '<w:tblGrid>' + grid + '</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>' + row + '</w:tr>' + extra + '</w:tbl>';
  }

  // Carta (21,59 × 27,94 cm), márgenes de 2,2 cm.
  var PAGE = { w: 12240, h: 15840, margin: 1247 };
  var TEXT_W = PAGE.w - PAGE.margin * 2;
  var LOGO_EMU = 457200; // 1,27 cm

  function wLogo() {
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + LOGO_EMU + '" cy="' + LOGO_EMU + '"/><wp:docPr id="1" name="Logo" descr="Logo de Funcode Studio CB"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + LOGO_EMU + '" cy="' + LOGO_EMU + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }

  function docxBody(doc, conLogo) {
    var out = [];
    var bloques = doc.bloques;
    bloques.forEach(function (b, i) {
      var next = bloques[i + 1];
      if (b.type === 'brand') {
        var brandText = wPara(wRun(b.text, { bold: true, color: COLOR.blue, spacing: 30, size: 24 }), { spacing: [0, 0] });
        out.push(conLogo
          ? wTable([900, TEXT_W - 900], [wPara(wLogo(), { spacing: [0, 0] }), brandText], { vAlign: 'center', pad: 0, padX: 0 })
          : brandText);
      } else if (b.type === 'title') {
        out.push(wPara(wRun(b.text), { style: 'Title' }));
      } else if (b.type === 'meta') {
        var rows = b.rows.map(function (r) {
          return wPara(wRun(r.label + ': ', { bold: true, color: COLOR.navy }) + wRun(r.run.text), { spacing: [0, 40] });
        }).join('');
        out.push(wTable([TEXT_W], [rows], { shade: COLOR.soft, leftBar: COLOR.blue, pad: 120, padX: 200 }));
      } else if (b.type === 'h1') {
        out.push(wPara(wRun(b.text), { style: 'Heading1' }));
      } else if (b.type === 'h2') {
        out.push(wPara(wRun(b.text), { style: 'Heading2' }));
      } else if (b.type === 'p') {
        if (b.amount) out.push(wPara(wRuns(b.runs, { bold: true, color: COLOR.navy, size: 32 }), { spacing: [0, 120] }));
        else if (b.strong) out.push(wPara(wRuns(b.runs, { color: COLOR.navy, size: 24 }), { spacing: [60, 120] }));
        else out.push(wPara(wRuns(b.runs), { keepNext: !!(next && (next.type === 'list' || next.type === 'checks')) }));
      } else if (b.type === 'list') {
        b.items.forEach(function (item, k) {
          var last = k === b.items.length - 1;
          out.push(wPara(wRun(item), { style: 'ListParagraph', num: true, spacing: last ? [0, 160] : null }));
        });
      } else if (b.type === 'checks') {
        b.items.forEach(function (c) {
          out.push(wPara(
            wRun(c.on ? '☒' : '☐', { font: 'Segoe UI Symbol', color: c.on ? COLOR.blue : COLOR.muted }) +
            wRun('  ' + c.text, { bold: c.on }),
            { spacing: [0, 30], ind: 284 }));
        });
        out.push(wPara('', { spacing: [0, 60] }));
      } else if (b.type === 'sign') {
        var colW = Math.floor(TEXT_W / 2);
        var cells = b.cols.map(function (c) {
          var parts = wPara(wRun(c.title, { bold: true, color: COLOR.navy }), { spacing: [0, 720], keepNext: true }) +
            wPara('', { border: { side: 'bottom', color: COLOR.text, size: 6, space: 1 }, spacing: [0, 40], keepNext: true }) +
            wPara(wRun('Firma', { color: COLOR.muted, size: 18 }), { spacing: [0, 80], keepNext: true });
          c.lines.forEach(function (l) { parts += wPara(wRun(l), { spacing: [0, 40], keepNext: true }); });
          if (c.date) parts += wPara(wRun('Fecha: ____________________'), { spacing: [120, 40], keepNext: true });
          return parts;
        });
        var total = b.total
          ? wPara(wRun(b.total.label + ': ', { bold: true }) + wRun(b.total.run.text), { spacing: [200, 120] })
          : '';
        out.push(wTable([colW, TEXT_W - colW], cells, { pad: 0, padX: 160, extraRow: total }));
        out.push(wPara('', { spacing: [0, 60] }));
      } else if (b.type === 'closing') {
        b.lines.forEach(function (l, j) {
          var o = { align: 'center', spacing: [j === 0 ? 480 : 0, 40] };
          if (j === 0) o.border = { side: 'top', color: COLOR.line, size: 6, space: 18 };
          if (l.quote) o.spacing = [160, 0];
          out.push(wPara(wRun(l.text, {
            bold: l.bold, italic: l.italic,
            color: l.big ? COLOR.blue : (l.small || l.quote ? COLOR.muted : COLOR.navy),
            size: l.big ? 26 : (l.small ? 19 : null),
            spacing: l.big ? 30 : null
          }), o));
        });
      }
    });
    return out.join('');
  }

  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles ' + NS + '>' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>' +
      '<w:color w:val="' + COLOR.text + '"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CO" w:eastAsia="es-CO" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:before="200" w:after="240"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="' + COLOR.navy + '"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:keepLines/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="3" w:color="' + COLOR.blue + '"/></w:pBdr>' +
      '<w:spacing w:before="400" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr>' +
      '<w:rPr><w:b/><w:bCs/><w:color w:val="' + COLOR.navy + '"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>' +
      '<w:rPr><w:b/><w:bCs/><w:color w:val="1E3A8A"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:after="60"/><w:ind w:left="567" w:hanging="283"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:tabs><w:tab w:val="right" w:pos="' + TEXT_W + '"/></w:tabs><w:spacing w:after="0"/></w:pPr>' +
      '<w:rPr><w:color w:val="' + COLOR.muted + '"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/>' +
      '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
      '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      '</w:styles>';
  }

  function numberingXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:numbering ' + NS + '>' +
      '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>' +
      '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="' + COLOR.blue + '"/></w:rPr></w:lvl>' +
      '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
  }

  function footerXml(doc) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:ftr ' + NS + '>' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="' + COLOR.line + '"/></w:pBdr></w:pPr>' +
      wRun(doc.pie) + '<w:r><w:tab/></w:r>' + wRun('Página ') +
      '<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>' + wRun(' de ') +
      '<w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>';
  }

  function documentXml(doc, conLogo) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document ' + NS + ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
      '<w:body>' + docxBody(doc, conLogo) +
      '<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/>' +
      '<w:pgSz w:w="' + PAGE.w + '" w:h="' + PAGE.h + '"/>' +
      '<w:pgMar w:top="' + PAGE.margin + '" w:right="' + PAGE.margin + '" w:bottom="' + PAGE.margin + '" w:left="' + PAGE.margin + '" w:header="567" w:footer="567" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }

  function coreXml(doc, autor) {
    var now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + esc(doc.titulo) + '</dc:title><dc:subject>' + esc(doc.asunto) + '</dc:subject>' +
      '<dc:creator>' + esc(autor) + '</dc:creator><dc:language>es-CO</dc:language>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  function docx(doc, estudio, logo) {
    var conLogo = !!(logo && logo.length);
    var files = [
      {
        name: '[Content_Types].xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Default Extension="png" ContentType="image/png"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
          '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
          '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
          '</Types>'
      },
      {
        name: '_rels/.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
          '</Relationships>'
      },
      { name: 'docProps/core.xml', data: coreXml(doc, estudio.nombre) },
      {
        name: 'word/_rels/document.xml.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
          '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
          (conLogo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : '') +
          '</Relationships>'
      },
      { name: 'word/document.xml', data: documentXml(doc, conLogo) },
      { name: 'word/styles.xml', data: stylesXml() },
      { name: 'word/numbering.xml', data: numberingXml() },
      { name: 'word/footer1.xml', data: footerXml(doc) }
    ];
    if (conLogo) files.push({ name: 'word/media/logo.png', data: logo });
    return zip(files, DOCX_MIME);
  }

  /* ======================================================================
     PDF (jsPDF, texto real y seleccionable)
     ====================================================================== */
  var jspdfPromise = null;
  function cargarJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!jspdfPromise) {
      jspdfPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'assets/vendor/jspdf/jspdf.umd.min.js';
        s.onload = function () {
          if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
          else reject(new Error('La librería de PDF no se cargó correctamente.'));
        };
        s.onerror = function () {
          jspdfPromise = null;
          reject(new Error('No se pudo cargar la librería de PDF. Revisa tu conexión e inténtalo de nuevo.'));
        };
        document.head.appendChild(s);
      });
    }
    return jspdfPromise;
  }

  // Las fuentes estándar del PDF (Helvetica) usan la codificación WinAnsi.
  // Se reemplazan los caracteres que no existen en ella (emojis, flechas…) para no imprimir símbolos raros.
  var WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  function pdfText(s) {
    return String(s == null ? '' : s).normalize('NFC').split('').map(function (ch) {
      var c = ch.charCodeAt(0);
      if ((c >= 0x20 && c <= 0x7E) || (c >= 0xA0 && c <= 0xFF) || WIN_ANSI_EXTRA.indexOf(ch) !== -1) return ch;
      if (c === 0x09) return ' ';
      var simple = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      if (simple.length === 1 && simple.charCodeAt(0) < 0x7F && simple.charCodeAt(0) >= 0x20) return simple;
      return '';
    }).join('').replace(/[\uD800-\uDFFF]/g, '');
  }

  function rgb(hex) { return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]; }

  function pdf(doc, estudio, logo) {
    return cargarJsPDF().then(function (JsPDF) {
      var pdf = new JsPDF({ unit: 'pt', format: 'letter', compress: true });
      var PW = pdf.internal.pageSize.getWidth();
      var PH = pdf.internal.pageSize.getHeight();
      var M = 62;            // margen (2,2 cm)
      var BOTTOM = PH - M - 10;
      var W = PW - M * 2;
      var y = M;

      function font(style, size, color) {
        pdf.setFont('helvetica', style || 'normal');
        pdf.setFontSize(size || 11);
        pdf.setTextColor.apply(pdf, rgb(color || COLOR.text));
      }
      function styleOf(r) { return r.bold && r.italic ? 'bolditalic' : r.bold ? 'bold' : r.italic ? 'italic' : 'normal'; }
      function addPage() { pdf.addPage(); y = M; }
      function ensure(h) { if (y + h > BOTTOM) addPage(); }

      // Parte texto con formato en líneas que caben en «width».
      function layout(runs, width, size) {
        var lines = [[]];
        var lineW = 0;
        function push(piece) { lines[lines.length - 1].push(piece); lineW += piece.w; }
        runs.forEach(function (r) {
          var st = styleOf(r);
          pdf.setFont('helvetica', st);
          pdf.setFontSize(size);
          pdfText(r.text).split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            var space = /^\s+$/.test(tok);
            if (space) tok = ' ';
            var w = pdf.getTextWidth(tok);
            if (space) {
              if (lineW > 0) push({ t: tok, w: w, st: st, r: r });
              return;
            }
            if (lineW + w > width && lineW > 0) {
              var line = lines[lines.length - 1];
              while (line.length && line[line.length - 1].t === ' ') line.pop();
              lines.push([]);
              lineW = 0;
            }
            // Palabra más larga que la línea (por ejemplo, una URL): se corta por letras.
            while (w > width) {
              var cut = tok.length - 1;
              while (cut > 1 && pdf.getTextWidth(tok.slice(0, cut)) > width - lineW) cut--;
              push({ t: tok.slice(0, cut), w: pdf.getTextWidth(tok.slice(0, cut)), st: st, r: r });
              lines.push([]);
              lineW = 0;
              tok = tok.slice(cut);
              w = pdf.getTextWidth(tok);
            }
            push({ t: tok, w: w, st: st, r: r });
          });
        });
        return lines.filter(function (l) { return l.length; });
      }

      function drawLines(lines, x, size, color, lh, align, width) {
        lines.forEach(function (line) {
          ensure(lh);
          var total = line.reduce(function (s, p) { return s + p.w; }, 0);
          var cx = align === 'center' ? x + (width - total) / 2 : x;
          line.forEach(function (piece) {
            font(piece.st, size, piece.color || color);
            pdf.text(piece.t, cx, y + size * 0.8);
            cx += piece.w;
          });
          y += lh;
        });
      }

      function paragraph(runs, o) {
        o = o || {};
        var size = o.size || 10.5;
        var lh = size * 1.45;
        var x = M + (o.indent || 0);
        var width = o.width || W - (o.indent || 0);
        var lines = layout(runs, width, size);
        if (o.keepWith) ensure(lh * Math.min(lines.length, 2) + o.keepWith);
        drawLines(lines, x, size, o.color, lh, o.align, width);
        y += o.after == null ? 6 : o.after;
      }

      // Alto mínimo de un bloque, para que un título no quede solo al final de la página.
      function altoFirmas(b) {
        var maxLines = Math.max.apply(null, b.cols.map(function (c) { return c.lines.length + (c.date ? 1 : 0); }));
        return 70 + maxLines * 16 + 20 + (b.total ? 34 : 0);
      }
      function altoMinimo(b) { return b && b.type === 'sign' ? altoFirmas(b) : 40; }

      var bloques = doc.bloques;
      bloques.forEach(function (b, i) {
        var next = bloques[i + 1];
        if (b.type === 'brand') {
          var size = 34;
          if (logo) {
            try { pdf.addImage(logo, 'PNG', M, y, size, size); } catch (e) { /* sin logo */ }
          }
          font('bold', 12.5, COLOR.blue);
          pdf.text(pdfText(b.text), M + (logo ? size + 12 : 0), y + size / 2 + 4.5, { charSpace: 1.2 });
          y += size + 18;
        } else if (b.type === 'title') {
          paragraph([{ text: b.text, bold: true }], { size: 23, color: COLOR.navy, after: 14 });
        } else if (b.type === 'meta') {
          var pad = 12;
          var lh = 10.5 * 1.5;
          var rowLines = b.rows.map(function (r) {
            return layout([{ text: r.label + ': ', bold: true }, { text: r.run.text }], W - pad * 2 - 6, 10.5);
          });
          var count = rowLines.reduce(function (s, l) { return s + l.length; }, 0);
          var h = count * lh + pad * 2 - 4;
          ensure(h);
          pdf.setFillColor.apply(pdf, rgb(COLOR.soft));
          pdf.rect(M, y, W, h, 'F');
          pdf.setFillColor.apply(pdf, rgb(COLOR.blue));
          pdf.rect(M, y, 3, h, 'F');
          y += pad;
          rowLines.forEach(function (lines) {
            lines.forEach(function (line) {
              line.forEach(function (p) { if (p.st === 'bold') p.color = COLOR.navy; });
            });
            drawLines(lines, M + pad + 6, 10.5, COLOR.text, lh, null, W);
          });
          y += pad + 10;
        } else if (b.type === 'h1') {
          ensure(14 * 1.4 + 22 + altoMinimo(next));
          y += 12;
          paragraph([{ text: b.text, bold: true }], { size: 14, color: COLOR.navy, after: 3 });
          pdf.setDrawColor.apply(pdf, rgb(COLOR.blue));
          pdf.setLineWidth(1);
          pdf.line(M, y, M + W, y);
          y += 10;
        } else if (b.type === 'h2') {
          ensure(12 * 1.4 + 34);
          y += 4;
          paragraph([{ text: b.text, bold: true }], { size: 12, color: '1E3A8A', after: 3 });
        } else if (b.type === 'p') {
          if (b.amount) paragraph(b.runs.map(function (r) { return { text: r.text, bold: true }; }), { size: 17, color: COLOR.navy, after: 8 });
          else if (b.strong) paragraph(b.runs, { size: 12, color: COLOR.navy, after: 8 });
          else paragraph(b.runs, { keepWith: next && (next.type === 'list' || next.type === 'checks') ? 16 : 0 });
        } else if (b.type === 'list') {
          b.items.forEach(function (item) {
            var size = 10.5;
            var lines = layout([{ text: item }], W - 22, size);
            ensure(size * 1.45);
            font('bold', size, COLOR.blue);
            pdf.text('•', M + 8, y + size * 0.8);
            drawLines(lines, M + 22, size, COLOR.text, size * 1.45, null, W - 22);
            y += 3;
          });
          y += 4;
        } else if (b.type === 'checks') {
          b.items.forEach(function (c) {
            var size = 10.5;
            ensure(size * 1.6);
            var bx = M + 10;
            var by = y + 1.5;
            pdf.setLineWidth(0.8);
            if (c.on) {
              pdf.setFillColor.apply(pdf, rgb(COLOR.blue));
              pdf.setDrawColor.apply(pdf, rgb(COLOR.blue));
              pdf.rect(bx, by, 10, 10, 'FD');
              pdf.setDrawColor(255, 255, 255);
              pdf.setLineWidth(1.4);
              pdf.lines([[2.4, 2.6], [4.4, -5.6]], bx + 2.2, by + 5.2);
            } else {
              pdf.setDrawColor.apply(pdf, rgb(COLOR.muted));
              pdf.rect(bx, by, 10, 10, 'S');
            }
            var lines = layout([{ text: c.text, bold: c.on }], W - 30, size);
            drawLines(lines, M + 28, size, COLOR.text, size * 1.6, null, W - 30);
          });
          y += 8;
        } else if (b.type === 'sign') {
          var colW = (W - 30) / 2;
          ensure(altoFirmas(b));
          var top = y;
          var bottom = y;
          b.cols.forEach(function (c, k) {
            var x = M + k * (colW + 30);
            y = top;
            font('bold', 10.5, COLOR.navy);
            pdf.text(pdfText(c.title), x, y + 9);
            y += 52;
            pdf.setDrawColor.apply(pdf, rgb(COLOR.text));
            pdf.setLineWidth(0.7);
            pdf.line(x, y, x + colW, y);
            y += 4;
            font('normal', 8.5, COLOR.muted);
            pdf.text('Firma', x, y + 8);
            y += 16;
            c.lines.forEach(function (l) {
              var lines = layout([{ text: l }], colW, 10.5);
              lines.forEach(function (line) {
                font('normal', 10.5, COLOR.text);
                pdf.text(line.map(function (p) { return p.t; }).join(''), x, y + 8.5);
                y += 15;
              });
            });
            if (c.date) {
              y += 8;
              font('normal', 10.5, COLOR.text);
              pdf.text('Fecha: ____________________', x, y + 8.5);
              y += 15;
            }
            bottom = Math.max(bottom, y);
          });
          y = bottom + 12;
          if (b.total) {
            y += 6;
            paragraph([{ text: b.total.label + ': ', bold: true }, b.total.run]);
          }
        } else if (b.type === 'closing') {
          var heights = b.lines.reduce(function (s, l) { return s + (l.big ? 22 : 16) + (l.quote ? 8 : 0); }, 0);
          ensure(heights + 40);
          y += 22;
          pdf.setDrawColor.apply(pdf, rgb(COLOR.line));
          pdf.setLineWidth(0.7);
          pdf.line(M, y, M + W, y);
          y += 16;
          b.lines.forEach(function (l) {
            if (l.quote) y += 8;
            paragraph([{ text: l.text, bold: l.bold, italic: l.italic }], {
              size: l.big ? 13 : (l.small ? 9.5 : 10.5),
              color: l.big ? COLOR.blue : (l.small || l.quote ? COLOR.muted : COLOR.navy),
              align: 'center', after: l.big ? 4 : 1
            });
          });
        }
      });

      // Pie de página con número de página.
      var total = pdf.getNumberOfPages();
      for (var n = 1; n <= total; n++) {
        pdf.setPage(n);
        pdf.setDrawColor.apply(pdf, rgb(COLOR.line));
        pdf.setLineWidth(0.5);
        pdf.line(M, PH - 44, PW - M, PH - 44);
        font('normal', 8.5, COLOR.muted);
        pdf.text(pdfText(doc.pie), M, PH - 30);
        pdf.text('Página ' + n + ' de ' + total, PW - M, PH - 30, { align: 'right' });
      }

      pdf.setProperties({
        title: pdfText(doc.titulo),
        subject: pdfText(doc.asunto),
        author: pdfText(estudio.nombre),
        creator: pdfText(estudio.nombre)
      });
      if (pdf.setLanguage) pdf.setLanguage('es-CO');
      return pdf.output('blob');
    });
  }

  /* ======================================================================
     Logo y descarga
     ====================================================================== */
  var logoPromise = null;
  function cargarLogo(url) {
    if (!logoPromise) {
      logoPromise = fetch(url)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (buf) { return new Uint8Array(buf); })
        .catch(function () { logoPromise = null; return null; });
    }
    return logoPromise;
  }

  // Devuelve la URL temporal del archivo para mostrar también un enlace de descarga
  // (algunos navegadores bloquean descargas automáticas seguidas). Quien la usa la libera.
  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return url;
  }

  window.FuncodeDocArchivos = {
    html: html,
    docx: function (doc, estudio) {
      return cargarLogo(estudio.logo).then(function (logo) { return docx(doc, estudio, logo); });
    },
    pdf: function (doc, estudio) {
      return cargarLogo(estudio.logo).then(function (logo) { return pdf(doc, estudio, logo); });
    },
    descargar: descargar
  };
})();
