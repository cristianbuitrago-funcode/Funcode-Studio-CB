#!/usr/bin/env python3
"""Genera las páginas públicas de Funcode Studio CB.

Las partes comunes (cabecera, menú, iconos y pie de página) viven una sola vez
en src/partials/, y el contenido de cada página en src/pages/<nombre>.html.
Este script las une y escribe <nombre>.html en la raíz del repositorio, que es
lo que publica GitHub Pages.

Uso:  python3 tools/build.py          (genera las páginas)
      python3 tools/build.py --check  (falla si alguna página no está al día)

Cada archivo de src/pages empieza con un bloque de datos:

    <!--meta
    title: Título de la pestaña
    description: Descripción para buscadores y redes
    nav: servicios            (enlace del menú que se marca como actual)
    -->
"""
import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
SITE = 'https://cristianbuitrago-funcode.github.io/Funcode-Studio-CB/'
NAV = ['inicio', 'servicios', 'proyectos', 'precios', 'proceso', 'nosotros', 'contacto']

HEADER_NOTE = '<!-- Archivo generado por tools/build.py a partir de src/pages/{name}.html. No lo edites aquí. -->\n'


def partial(name):
    return (SRC / 'partials' / f'{name}.html').read_text(encoding='utf-8')


def parse(path):
    text = path.read_text(encoding='utf-8')
    match = re.match(r'<!--meta\n(.*?)\n-->\n', text, re.S)
    if not match:
        sys.exit(f'{path}: falta el bloque <!--meta ... -->')
    meta = {}
    for line in match.group(1).splitlines():
        key, _, value = line.partition(':')
        meta[key.strip()] = value.strip()
    for key in ('title', 'description', 'nav'):
        if key not in meta:
            sys.exit(f'{path}: falta «{key}» en el bloque meta')
    return meta, text[match.end():]


def render(name, meta, body):
    filename = 'index.html' if name == 'index' else f'{name}.html'
    url = SITE if name == 'index' else SITE + filename
    extra_head = partial('schema') if name == 'index' else ''

    head = partial('head')
    values = {
        'title': meta['title'],
        'social_title': meta.get('social_title', meta['title']),
        'description': meta['description'],
        'url': url,
        'site': SITE,
        'extra_head': extra_head,
    }
    for key, value in values.items():
        safe = value if key == 'extra_head' else html.escape(value, quote=True)
        head = head.replace('{{' + key + '}}', safe)

    header = partial('header')
    for item in NAV:
        current = ' aria-current="page"' if item == meta['nav'] else ''
        header = header.replace('{{current:' + item + '}}', current)

    page = (
        head.replace('<!doctype html>\n', '<!doctype html>\n' + HEADER_NOTE.format(name=name), 1)
        + '<body>\n'
        + partial('sprite')
        + '\n'
        + header
        + '\n  <main id="contenido">\n'
        + body.rstrip('\n')
        + '\n  </main>\n\n'
        + partial('footer')
        + '\n  <script src="js/config.js" defer></script>\n'
        + '  <script src="js/main.js" defer></script>\n'
        + '</body>\n</html>\n'
    )
    leftover = re.findall(r'\{\{[^}]+\}\}', page)
    if leftover:
        sys.exit(f'{name}: marcadores sin reemplazar: {leftover}')
    return filename, page


def main():
    check = '--check' in sys.argv
    stale = []
    pages = sorted((SRC / 'pages').glob('*.html'))
    for path in pages:
        filename, page = render(path.stem, *parse(path))
        target = ROOT / filename
        if check:
            if not target.exists() or target.read_text(encoding='utf-8') != page:
                stale.append(filename)
        else:
            target.write_text(page, encoding='utf-8')
            print(f'  {filename}')
    if check and stale:
        sys.exit('Páginas desactualizadas (ejecuta python3 tools/build.py): ' + ', '.join(stale))
    if check:
        print(f'{len(pages)} páginas al día.')


if __name__ == '__main__':
    main()
