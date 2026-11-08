# LIBRA VOZ 5.0 — Arquitectura de interacción por voz

**Estado:** diseño técnico propuesto para implementación incremental.  
**Regla:** el canal de dictado y el canal de comandos son sesiones distintas. Nunca deben escuchar/escribir en el mismo buffer.

## 1. Principio de interacción

- **Dictado de libro:** captura continua de la narración del autor. Solo el contenido de esta sesión puede incorporarse al manuscrito.
- **Comandos de LIBRA:** sesión breve, explícita y separada para navegar o ejecutar acciones. Su transcripción se descarta después de interpretar la intención; nunca se concatena con el manuscrito.
- **Controles táctiles:** disponibles en todo momento como alternativa.
- **Escucha permanente:** no se habilita por defecto. La activación por palabra clave solo se evaluará si puede ejecutarse de forma confiable, visible, con consentimiento, control de permisos y sin mantener el micrófono abierto de forma inesperada.

## 2. Máquina de estados

`IDLE` → `COMMAND_LISTENING` → `COMMAND_CONFIRMATION` → `EXECUTING` → `IDLE`

`IDLE` → `DICTATION_RECORDING` ↔ `DICTATION_PAUSED` → `DICTATION_REVIEW` → `IDLE`

Reglas:
1. `COMMAND_LISTENING` solo puede comenzar si no hay una sesión de dictado activa.
2. Para entrar a comandos durante un dictado, primero pausar el dictado y persistir el audio capturado.
3. Al volver al dictado, abrir una nueva sesión de reconocimiento y continuar agregando únicamente al buffer de manuscrito.
4. Cada sesión tiene identificador, estado, idioma y buffer propios.
5. Un error del reconocedor no debe cerrar ni descartar el archivo de audio.
6. Las órdenes que alteran o eliminan contenido requieren confirmación explícita.

## 3. Contrato de eventos

Cada evento de voz debe llevar:
- `sessionId`
- `mode: "dictation" | "command"`
- `source: "android" | "web"`
- `status`
- `timestamp`
- `text` (solo en eventos de resultado)

El frontend rechaza eventos cuyo `sessionId` no coincida con la sesión activa. Un evento `mode=command` jamás puede llamar a la función que agrega texto al manuscrito.

## 4. Catálogo inicial de comandos

| Intención | Frases de ejemplo | Acción |
|---|---|---|
| Crear libro | “Quiero empezar un libro”, “Crear un libro” | Abre creación y pregunta si quiere comenzar a grabar. |
| Iniciar dictado | “Comenzar a grabar” | Inicia una sesión de dictado con permiso concedido. |
| Pausar | “Pausar grabación” | Pausa captura y guarda el estado. |
| Continuar | “Continuar grabación” | Reanuda captura. |
| Finalizar | “Terminar esta grabación” | Cierra sesión y prepara revisión. |
| Escuchar audio | “Escuchar lo que grabé” | Reproduce el audio seleccionado. |
| Leer transcripción | “Leer mi transcripción” | TTS de la transcripción, sin grabar. |
| Crear libro | “Crear un libro con este material” | Solicita selección/confirmación de material y compone borrador. |
| Biblioteca | “Mostrar mi biblioteca” | Abre biblioteca. |
| Abrir último libro | “Abrir mi último libro” | Abre el libro más reciente. |
| Leer prólogo | “Leerme el prólogo” | TTS del prólogo del libro activo. |
| Corregir capítulo | “Corregir este capítulo” | Abre corrección del capítulo activo y confirma el alcance. |
| Cambiar título | “Cambiar el título” | Solicita el nuevo título y confirma antes de guardar. |
| Nueva portada | “Crear una portada nueva” | Inicia generación solo si el proveedor está configurado y el costo/consentimiento están claros. |
| Preparar KDP | “Preparar mi libro para Amazon” | Ejecuta validaciones y exportación, no publica. |
| Publicar | “Quiero publicar este libro” | Abre el checklist KDP; la aprobación y publicación final siguen siendo del autor. |

## 5. Seguridad y confirmaciones

Confirmación obligatoria:
- borrar grabaciones o libros;
- sobrescribir/reemplazar una versión;
- modificar título/autor/metadata final;
- generar una portada con un servicio que consuma cuota;
- exportar versión marcada como final;
- iniciar cualquier proceso externo de publicación.

La confirmación puede ser táctil o hablada, pero para operaciones destructivas debe requerir una acción inequívoca y no aceptar una frase ambigua.

## 6. UX móvil

- Botón visible “Hablar con Libra” activa una sesión breve de comandos.
- Durante dictado, la pantalla muestra claramente “DICTANDO TU LIBRO” y controles grandes de pausa/finalización.
- Al entrar en comandos, la app indica “DICTADO EN PAUSA — ESCUCHANDO COMANDO”.
- Respuesta hablada breve y texto visible para confirmar lo entendido.
- Si la intención tiene baja confianza, preguntar una sola aclaración o mostrar acciones táctiles.
- No mostrar un falso indicador “Hola Libra siempre activo” si no hay un servicio de escucha persistente real.

## 7. Implementación por etapas

1. Crear un módulo `VoiceSessionController` independiente de la lógica editorial.
2. Encapsular la sesión nativa Android y la sesión web en adaptadores separados.
3. Añadir un parser de intenciones limitado a un catálogo explícito; no ejecutar texto arbitrario como código ni aceptar instrucciones no autorizadas.
4. Añadir confirmaciones y pruebas unitarias de cada intención.
5. Simular eventos cruzados para demostrar que los comandos no contaminan la transcripción.
6. Probar en hardware con interrupciones, pérdida de red, cambios de foco de audio y permisos denegados.

## 8. Criterios de aceptación

- Una frase de comando nunca aparece en el texto del libro.
- Un fragmento de dictado nunca ejecuta una acción de navegación.
- No se solapan sesiones de reconocimiento.
- La grabación se conserva aunque el reconocedor falle.
- Todas las acciones críticas tienen confirmación.
- Todos los comandos tienen alternativa táctil.
- La app informa claramente qué modo está activo.
