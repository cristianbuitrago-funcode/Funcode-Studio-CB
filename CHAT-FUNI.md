# Chat de Funi: cómo funciona y cómo activar la inteligencia artificial

En todas las páginas, al tocar a **Funi** (la mascota) se abre el chat **«Pregúntale a Funi»**.

## Dos modos

| Modo | Qué hace | Qué necesita |
|---|---|---|
| **Preguntas frecuentes** (activo ahora) | Responde unas 75 preguntas reales sobre Funcode: servicios, precios, tiempos, proceso, pagos, portafolio, tecnologías y más. Si no sabe algo, lo dice y ofrece WhatsApp. | Nada. Es gratis. |
| **Inteligencia artificial** (opcional) | Entiende preguntas escritas de cualquier forma y responde con Claude, usando solo la información de Funcode y las 12 reglas del asistente. Si la IA falla, responde el modo de preguntas frecuentes. | Una llave de la API de Claude (de pago) y un Google Apps Script. |

En los dos modos, Funi se presenta como el asistente virtual de Funcode Studio CB. Tiene prohibido inventar
precios, descuentos, plazos, clientes, garantías o promesas, y no emite cotizaciones definitivas.

## Qué hace Funi

- **Entiende la intención**, no solo palabras exactas: errores de ortografía, abreviaturas («q», «wsp»), plurales y
  palabras en otro orden. Si una pregunta trae dos temas, responde los dos.
- **Pregunta cuando algo es ambiguo**: ante «quiero una aplicación» pregunta si es para Android, iPhone o el navegador,
  con botones.
- **Recuerda el tema**: si la persona habló de una tienda y luego pregunta «¿cuánto cuesta?», responde el precio de una
  tienda; y si prepara su solicitud, no le vuelve a preguntar qué servicio quiere.
- **Dice el estado de cada proyecto**: disponible (LifeCoinQuest, Ofimática 9°, Ajedrez Inclusivo), realizado
  (Camisas Col) o en desarrollo (Funcode Academy, Funcode Code Analyzer).
- **Si no sabe algo**, usa la respuesta recomendada («prefiero no darte una respuesta incorrecta…»), propone temas y
  ofrece WhatsApp.

## «📝 Preparar mi solicitud»

Cuando alguien muestra interés en un servicio, Funi le ofrece (sin insistir) preparar su solicitud: preguntas cortas, de una
en una, y todas se pueden omitir:

1. qué quiere desarrollar (página web, tienda, aplicación, plataforma educativa, sistema, clases, mejorar un proyecto);
2. su idea o el problema que quiere resolver;
3. para qué negocio o institución es;
4. según el servicio: la plataforma (apps), su nivel (clases) o las funciones principales;
5. para cuándo lo quiere;
6. su presupuesto aproximado (opcional, «prefiero no decirlo»);
7. su nombre (opcional).

Al final muestra un resumen y el botón **«Enviar por WhatsApp»**, que abre WhatsApp con un mensaje organizado para ti,
con la **categoría** (desarrollo web, software, educativo, formación, mantenimiento o consulta general) y el **nivel de
interés** (alto, medio o no calificado), como pide la guía de clasificación.

**Privacidad:** nada de esto se guarda en un servidor. Las respuestas quedan solo en el navegador de la persona
(se borran al cerrar la pestaña) y solo te llegan si ella toca «Enviar por WhatsApp». Con la IA activada, las respuestas
de la solicitud tampoco se envían a la IA.

## Cambiar lo que Funi sabe

Todo está en **`assets/chat/conocimiento.json`**:

- `intenciones`: las preguntas frecuentes. Cada una tiene un `titulo` (el botón que aparece cuando Funi no entiende),
  palabras clave (`claves`), la respuesta y botones (`enlaces`). Si tiene `"whatsapp": true`, agrega el botón de WhatsApp.
  - Las claves pueden ser palabras o frases cortas; no hace falta escribir tildes, plurales ni variantes:
    `js/chat-motor.js` entiende errores de ortografía, abreviaturas y palabras en otro orden.
  - `cuesta|vale|precio tienda` significa «(cuesta o vale o precio) y tienda».
  - `quienes +son` obliga a que esté la palabra «son» (las palabras comunes como «son», «que» o «no» se ignoran si
    no llevan `+`).
  - `opciones`: botones con otras preguntas (por ejemplo, Android / iPhone / navegador).
  - `contexto` y `segunContexto`: el tema que recuerda Funi y la respuesta que cambia según ese tema.
  - `ofrecerSolicitud`: ofrece «📝 Preparar mi solicitud» después de esa respuesta.
- `solicitud`: los textos, los pasos y las categorías de «Preparar mi solicitud».
- `temas`: los temas que Funi ofrece como botones cuando no entiende una pregunta.
- `datos`: el texto que lee la inteligencia artificial. Si cambian los precios o los servicios, actualízalo aquí también.
- `sugerencias`: las preguntas que aparecen como botones al abrir el chat.

---

## Activar la inteligencia artificial (opcional)

> **Costo:** la API de Claude se paga por uso y cada respuesta tiene un costo pequeño. El script
> limita el uso a **60 respuestas por hora y 300 por día**, para que nadie pueda gastarte los
> créditos. En la consola de Claude también puedes poner un límite de gasto mensual.
> Por defecto usa el modelo `claude-opus-5-5`. Si quieres gastar mucho menos, usa
> `claude-haiku-5-5` (Parte 3, propiedad `MODELO`).

Te recomiendo hacer todo **desde un computador**.

### Parte 1: crear la llave de la API de Claude

1. Entra a <https://console.anthropic.com> y crea una cuenta, o entra con la que ya tienes.
2. En **Billing** (facturación), agrega un método de pago y compra créditos (por ejemplo, 5 USD).
3. En **Settings → Limits**, pon un límite de gasto mensual (por ejemplo, 5 USD) para estar tranquilo.
4. Ve a **API keys → Create Key**. Ponle de nombre `Chat Funi` y pulsa **Create**.
5. Copia la llave (empieza por `sk-ant-`). **Guárdala en privado: solo se muestra una vez.**
   Nunca la pegues en la página ni en `js/config.js`.

### Parte 2: crear el proyecto en Google Apps Script

1. Abre <https://script.google.com> con tu cuenta de Google y pulsa **«Nuevo proyecto»**.
2. Arriba a la izquierda, cambia **«Proyecto sin título»** por `Chat Funi`.
3. Abre en otra pestaña el código:
   <https://raw.githubusercontent.com/cristianbuitrago-funcode/Funcode-Studio-CB/main/apps-script/chat-funi.gs>
   (si Chrome ofrece traducir la página, **no la traduzcas**).
4. Selecciona todo (**Ctrl + A**), cópialo (**Ctrl + C**) y pégalo en **Código.gs** de Apps Script,
   reemplazando lo que había.
5. Guarda con **Ctrl + S**.

### Parte 3: guardar la llave (en privado)

1. En la barra de la izquierda, pulsa el **engranaje ⚙️ «Configuración del proyecto»**.
2. Baja a **«Propiedades de la secuencia de comandos»** y pulsa **«Agregar propiedad de la secuencia de comandos»**:
   - **Propiedad:** `ANTHROPIC_API_KEY`
   - **Valor:** tu llave de la Parte 1
3. Opcional, más propiedades:
   - `MODELO` → `claude-haiku-5-5` para gastar menos (si no la creas, usa `claude-opus-5-5`)
   - `LIMITE_HORA` → por ejemplo `30`
   - `LIMITE_DIA` → por ejemplo `150`
4. Pulsa **«Guardar propiedades de la secuencia de comandos»**.

### Parte 4: probar

1. Vuelve al editor (`< >`). En el menú junto a **Ejecutar**, elige **`probarChat`** y pulsa **▶ Ejecutar**.
2. La primera vez, Google pide permisos: **Revisar permisos** → tu cuenta → **Configuración avanzada** →
   **Ir a Chat Funi (no seguro)** → **Permitir**. Los permisos sirven para conectarse a la API de Claude y leer tu página.
3. En el **Registro de ejecución** debe aparecer **«Respuesta de Funi: …»**.

### Parte 5: publicar como aplicación web

1. **Implementar → Nueva implementación** → engranaje ⚙️ → **Aplicación web**.
2. **Ejecutar como:** Yo. **Quién tiene acceso:** Cualquier usuario.
3. Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
4. **Envíale esa URL a Claude** o pégala en `chatUrl` dentro de `js/config.js` y publica el cambio.

Cuando esté activa, debajo de «Pregúntale a Funi» dirá **«Asistente con inteligencia artificial»**.

### Si cambias el código más adelante

**Implementar → Administrar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar.**
Así la URL `/exec` no cambia.

## Problemas comunes

| Qué pasa | Solución |
|---|---|
| `probarChat` dice «Falta la propiedad ANTHROPIC_API_KEY» | Parte 3: revisa el nombre exacto y que guardaste |
| «Claude respondió 401» | La llave está mal copiada o la borraste. Crea otra (Parte 1) |
| «Claude respondió 400» con un mensaje de créditos | No tienes saldo: agrega créditos en Billing |
| El chat responde, pero sigue diciendo «Asistente virtual de Funcode» | `chatUrl` está vacío o no termina en `/exec` |
| Funi responde preguntas frecuentes en vez de usar la IA | Se alcanzó el límite por hora o por día, o la API falló. Funi usa las preguntas frecuentes como respaldo |
