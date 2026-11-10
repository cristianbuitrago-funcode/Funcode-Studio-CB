# Chat de Funi: cómo funciona y cómo activar la inteligencia artificial

En todas las páginas, al tocar a **Funi** (la mascota) se abre el chat **«Pregúntale a Funi»**.

## Dos modos

| Modo | Qué hace | Qué necesita |
|---|---|---|
| **Preguntas frecuentes** (activo ahora) | Responde precios, tiempos, servicios, proceso, contacto, pagos, proyectos y más con la información real de la página. Si no sabe algo, lo dice y ofrece WhatsApp o el formulario. | Nada. Es gratis. |
| **Inteligencia artificial** (opcional) | Entiende preguntas escritas de cualquier forma y responde con Claude, usando solo la información de Funcode. Si la IA falla, responde el modo de preguntas frecuentes. | Una llave de la API de Claude (de pago) y un Google Apps Script. |

En los dos modos, Funi avisa que es un asistente automático. Tiene prohibido inventar precios,
plazos, clientes o promesas, y nunca pide datos personales.

## Cambiar lo que Funi sabe

Todo está en **`assets/chat/conocimiento.json`**:

- `intenciones`: las preguntas frecuentes. Cada una tiene un `titulo` (el botón que aparece cuando Funi no entiende), palabras clave (`claves`), la respuesta y botones (`enlaces`). Si tiene `"whatsapp": true`, agrega el botón de WhatsApp.
  Las claves pueden ser palabras o frases cortas; no hace falta escribir tildes, plurales ni variantes: `js/chat-motor.js` entiende errores de ortografía, abreviaturas («q», «xq», «wsp») y palabras en otro orden.
- `temas`: los temas que Funi ofrece como botones cuando no entiende una pregunta. Solo si vuelve a fallar sugiere hablar con Cristian.
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
| El chat responde, pero sigue diciendo «Asistente automático» | `chatUrl` está vacío o no termina en `/exec` |
| Funi responde preguntas frecuentes en vez de usar la IA | Se alcanzó el límite por hora o por día, o la API falló. Funi usa las preguntas frecuentes como respaldo |
