# Funcode Studio CB — sitio web oficial

Página web de Funcode Studio CB: estudio tecnológico en crecimiento que desarrolla páginas web,
aplicaciones y soluciones educativas para proyectos pequeños y medianos, y construye productos propios.

HTML5 + CSS3 + JavaScript puro. Sin frameworks, sin proceso de compilación y sin dependencias.

## Estructura

| Archivo | Qué contiene |
|---|---|
| `index.html`, `servicios.html`, `proyectos.html`, `precios.html`, `proceso.html`, `nosotros.html`, `contacto.html` | Páginas públicas **generadas**: no se editan directamente (ver «Editar las páginas») |
| `src/pages/*.html` | Contenido de cada página pública |
| `src/partials/*.html` | Partes comunes: `<head>`, menú, iconos (SVG sprite), pie de página y datos estructurados |
| `apps-script/aviso-whatsapp.gs` | Código para Google Apps Script que te avisa por WhatsApp de cada solicitud (ver `AVISO-WHATSAPP.md`) |
| `tools/build.py` | Une `src/partials` + `src/pages` y genera las páginas públicas |
| `css/styles.css` | Estilos, variables de color (`:root`), responsive y `prefers-reduced-motion` |
| `js/config.js` | **Único archivo que hay que editar**: WhatsApp, correo, redes y endpoint del formulario |
| `js/main.js` | Menú móvil, animaciones de aparición, enlace activo, enlaces de contacto y formulario |
| `admin.html`, `js/admin.js`, `css/admin.css` | Panel del organizador: solicitudes en tiempo real (Firebase) |
| `mis-solicitudes.html`, `js/cliente.js` | Portal del cliente: seguimiento de sus solicitudes con Google |
| `js/estados.js` | Estados de una solicitud, compartidos por el panel y el portal |
| `firestore.rules`, `firebase.json` | Reglas de seguridad de Firestore y configuración de emuladores |
| `assets/vendor/firebase/` | SDK de Firebase 12.19.0 (compat), solo lo usa el panel |
| `assets/img/projects/` | Capturas reales de los proyectos (WebP) |
| `assets/img/og-image.jpg` | Imagen para compartir en redes (1200×630) |
| `assets/icons/` | Logo, favicon e iconos de la app |
| `site.webmanifest`, `robots.txt`, `sitemap.xml`, `404.html` | Manifest, SEO y página de error |

## Editar las páginas

La página está dividida en 7 páginas que comparten menú, iconos y pie de página. Para no repetir
esas partes en cada archivo, se escriben una sola vez en `src/partials/` y un script las une:

1. Edita el contenido en `src/pages/<página>.html` (o el menú y pie en `src/partials/`).
2. Genera las páginas: `python3 tools/build.py`
3. Publica los archivos `.html` generados junto con los cambios de `src/`.

`python3 tools/build.py --check` avisa si alguna página generada quedó desactualizada.
Solo necesita Python 3, sin instalar nada. `admin.html` y `mis-solicitudes.html` se editan directamente.

## Ver la página en local

Abre `index.html` en el navegador, o sirve la carpeta (recomendado):

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Pendiente de completar (marcado con `TODO` en `js/config.js`)

Mientras un dato esté vacío, la página lo muestra como **«Próximamente»** y no como un enlace falso.

- [ ] `whatsapp`: número con indicativo, solo dígitos (ej. `573001234567`). Al configurarlo aparecen
      los botones «Hablar por WhatsApp» y el botón flotante.
- [ ] `email`: correo público de contacto.
- [ ] `social.instagram`, `social.facebook`, `social.linkedin`: URL completa de cada perfil.
- [ ] `firebase`: datos de tu proyecto de Firebase para guardar las solicitudes (ver `FIREBASE.md`).

`social.github` ya apunta a https://github.com/cristianbuitrago-funcode.

## Formulario de contacto y panel del organizador

**Recomendado: Firebase.** Sigue [`FIREBASE.md`](FIREBASE.md). Cada solicitud se guarda en
Firestore y la ves en `admin.html` (enlace «Acceso del organizador» al final de la página),
entrando con tu cuenta de Google. Solo el correo autorizado en `firestore.rules` puede leerlas.

El formulario elige automáticamente cómo enviar:

- **Con `firebase` configurado**: guarda la solicitud en Firestore.
- **Sin Firebase pero con `formEndpoint`**: la envía a ese servicio (ver abajo).
- **Sin ninguno de los dos**: valida los datos y, al pulsar «Enviar solicitud», avisa claramente que el
  envío automático no está activo. Ofrece «Copiar solicitud» y, si ya configuraste WhatsApp o correo,
  botones para enviarla por esos medios con el mensaje ya escrito. Debajo del botón hay un aviso visible.
- En los dos primeros casos, si falla, conserva los datos y ofrece las mismas alternativas.

Alternativa sin Firebase, con [Formspree](https://formspree.io) (llega a tu correo):

1. Crea una cuenta y un formulario nuevo; te dará una URL como `https://formspree.io/f/abcdwxyz`.
2. Pégala en `formEndpoint` dentro de `js/config.js`.
3. Envía una solicitud de prueba y confirma el correo de activación que manda Formspree.

Sirve cualquier servicio equivalente (Getform, Web3Forms, un backend propio o una Cloud Function de
Firebase) que acepte POST con `FormData` y responda con un estado 2xx. El campo oculto `_gotcha`
es una trampa anti-spam: si llega con contenido, la página no envía nada.

Campos enviados: `nombre`, `negocio`, `correo`, `whatsapp`, `tipo`, `descripcion`, `presupuesto`,
`fecha` y `_subject`.

## Publicar en GitHub Pages

1. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**.
2. Elige la rama y la carpeta `/ (root)`, y guarda.
3. La página quedará en `https://cristianbuitrago-funcode.github.io/Funcode-Studio-CB/`.

Las URL absolutas (canonical, Open Graph, JSON-LD, `robots.txt`, `sitemap.xml` y los enlaces de
`404.html`) ya usan esa dirección. **Si usas un dominio propio**, reemplaza
`https://cristianbuitrago-funcode.github.io/Funcode-Studio-CB/` en esos archivos, y
`/Funcode-Studio-CB/` por `/` en `404.html`.

## Enlaces de los proyectos

| Proyecto | «Ver proyecto» apunta a |
|---|---|
| LifeCoinQuest | Repositorio `Lifequest1` (README con capturas y el APK). Botón extra: descarga directa del APK desde *Releases* |
| Ajedrez Inclusivo | https://cristianbuitrago-funcode.github.io/Lifequest/ (el repositorio `Lifequest` contiene hoy el ajedrez) |
| Ofimática 9° | https://cristianbuitrago-funcode.github.io/PAGINA-WEB/ |

Si publicas la versión web de LifeCoinQuest, cambia el `href` de su botón «Ver proyecto» en `index.html`.

Las capturas de `assets/img/projects/` se tomaron ejecutando cada aplicación. Si cambian mucho,
conviene reemplazarlas por capturas nuevas con el mismo nombre y tamaño (1200×750 escritorio,
360×779 móvil).

## Criterios de contenido

La página vende sin exagerar: no incluye clientes, testimonios, cifras, años de experiencia ni
certificaciones. Al agregar contenido nuevo, mantén ese criterio y usa solo proyectos y
funcionalidades reales.

© 2026 Funcode Studio CB
