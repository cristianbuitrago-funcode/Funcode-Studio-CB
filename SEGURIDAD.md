# Seguridad de Funcode Studio CB

Resumen de cómo está protegida la página, qué se revisó (OWASP Top 10 / ASVS) y qué falta.
Última auditoría: noviembre de 2026.

## Cómo está construida

| Parte | Tecnología | Quién protege los datos |
|---|---|---|
| Páginas públicas | HTML, CSS y JavaScript estáticos en GitHub Pages | No guardan datos; el formulario escribe en Firestore |
| Formulario, reseñas | API REST de Firestore | **Reglas de `firestore.rules`** (validan cada campo en el servidor) |
| Panel (`admin.html`) y «Mis solicitudes» | Firebase Auth (Google) + Firestore | Reglas: solo el correo del organizador ve todo; cada cliente solo lo suyo |
| Aviso por correo/WhatsApp y chat con IA | Google Apps Script | Llaves en las propiedades del script, límites por hora |

No hay servidor propio, base de datos SQL, contraseñas ni subida de archivos.

## Medidas activas

- **Reglas de Firestore**: cada solicitud se valida en el servidor (campos permitidos, longitudes, formato del correo, WhatsApp, fecha, presupuesto de la lista y estado inicial). Nadie puede leer solicitudes, notas ni cotizaciones sin ser el organizador. Los clientes solo leen las solicitudes de su correo de Google verificado.
- **Contra XSS**: el JavaScript nunca inserta como HTML el texto de visitantes, clientes o la IA (`textContent`). Además, todas las páginas tienen una **Content-Security-Policy** que bloquea scripts inyectados, atributos `onclick`/`onerror` y scripts de otros dominios.
- **Contra clickjacking**: `js/seguridad.js` oculta el panel y «Mis solicitudes» si otra página intenta mostrarlos dentro de un marco.
- **Enlaces seguros**: los `mailto:` solo se crean con correos de formato normal, los enlaces externos usan `rel="noopener"` y el chat cambia cualquier enlace de WhatsApp por el número oficial.
- **Apps Script**: avisos y chat con límites por hora y por día; el aviso quita enlaces del texto recibido.
- **Sin secretos en el código**: la `apiKey` de Firebase de `js/config.js` es pública por diseño (identifica el proyecto, no da permisos). Las llaves de CallMeBot y Claude viven solo en Apps Script.

## Después de cada cambio en `firestore.rules`

Publica las reglas en <https://console.firebase.google.com/project/funcode-studio-cb/firestore/rules>
(borra todo, pega el contenido de `firestore.rules` y pulsa **Publicar**). Si no las publicas, Firebase sigue usando las anteriores.

## Si la Content-Security-Policy bloquea algo

Señal: un botón o el inicio de sesión dejan de funcionar y la consola del navegador (F12) dice
«Refused to … because it violates the following Content Security Policy directive».

- Páginas públicas: la política está en `src/partials/head.html` (luego `python3 tools/build.py`).
- Panel y «Mis solicitudes»: en `admin.html` y `mis-solicitudes.html`.
- Si agregas un script, una fuente o un servicio nuevo, añade su dominio a la directiva que diga la consola.
- El script en línea del `<head>` de las páginas públicas está autorizado por su hash `sha256`. Si lo cambias, hay que recalcular el hash.

## Pendiente (requiere acción o decisión)

| Prioridad | Qué | Cómo |
|---|---|---|
| Alta | Publicar las reglas nuevas | Ver arriba |
| Alta | Actualizar el script de avisos | Copiar `apps-script/aviso-whatsapp.gs` en Apps Script → Implementar → Administrar implementaciones → Editar → Nueva versión |
| Media | Restringir la `apiKey` | Google Cloud Console → APIs y servicios → Credenciales → la llave del navegador → Restricciones de aplicaciones: sitios web `https://cristianbuitrago-funcode.github.io/*` y `http://localhost:*/*` |
| Media | Spam en el formulario | Activar Firebase App Check con reCAPTCHA (cambio de arquitectura: consultar antes) |
| Baja | Cabeceras HTTP (HSTS, `frame-ancestors`, `X-Content-Type-Options`) | GitHub Pages no permite configurarlas; se lograría poniendo Cloudflare delante o cambiando de hosting |
| Baja | Revisar «Enforce HTTPS» | GitHub → Settings → Pages |
| Baja | Dominios autorizados de Firebase Auth | Dejar solo `cristianbuitrago-funcode.github.io`, `localhost` y los de Firebase |
