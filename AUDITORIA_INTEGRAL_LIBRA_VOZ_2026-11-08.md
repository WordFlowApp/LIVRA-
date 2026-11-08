# Auditoría integral de LIBRA VOZ
**Fecha de corte:** 8 de noviembre de 2026  
**Repositorio:** WordFlowApp/LIVRA-  
**Base estable inspeccionada:** `main` — `bda55d9abd9b5b81310038de78ed89a5a756c319`  
**Rama de trabajo:** `release/libra-voz-5.0-foundation`  
**Alcance:** auditoría estática de repositorio, ramas, flujos GitHub Actions y configuración/código desplegado del Worker. No equivale a prueba física en un teléfono.

## 1. Dictamen ejecutivo

LIBRA VOZ parte de una aplicación web móvil empaquetada en un contenedor Android WebView. La base existente conserva una biblioteca local, grabaciones de audio, transcripción y una primera composición editorial con Workers AI. No es una aplicación vacía y no corresponde reconstruirla desde cero.

Sin embargo, la versión estable inspeccionada **no cumple todavía la visión integral de LIBRA VOZ**. La experiencia de control por comandos hablados no está implementada; la generación de portadas a color está desactivada en el Worker desplegado; no se encontró exportación real PDF ni EPUB; no existe sincronización cloud demostrada; la publicación de Amazon es solamente un enlace genérico; y no existe un flujo de aprobación editorial ni un historial completo de versiones.

**Resultado:** la base es recuperable, pero todavía no es un producto editorial listo para comercialización ni una versión final 5.0.

## 2. Estado comprobado por subsistema

| Subsistema | Estado observado | Evidencia / límite |
|---|---|---|
| Web móvil | Parcialmente funcional | HTML/CSS/JS responsive existente; home actual ofrece GRABAR y MI BIBLIOTECA, no el tercer acceso MI VOZ. |
| Android | Parcial | MainActivity usa WebView y puente JavaScript nativo. La APK carga el sitio publicado de GitHub Pages, no una copia local completa de la aplicación. |
| Grabación | Implementada con límites | AudioRecord nativo PCM 16 kHz mono; pausa/reanudación y finalización están presentes en el código. La ruta nativa rechaza Android anterior a API 33. |
| Recuperación tras cierre/interrupción | Incompleta en main | Main no escribe una copia de recuperación persistente. La rama safety sí contiene un mecanismo de archivo pendiente y confirmación de recuperación. |
| Transcripción | Implementada parcialmente | Android SpeechRecognizer / SpeechRecognition y Worker Whisper. Worker limita audio a 20 MB y cada ejecución a 40 s. |
| Comandos de voz | No implementados | No hay parser/intérprete de intenciones ni separación entre canal de dictado y canal de comandos. |
| Composición editorial IA | Parcial | POST /compose con Llama 3.3 70B, resumen, prólogo y entre 2 y 6 capítulos. Texto máximo 24.000 caracteres; timeout 40 s y un intento de reparación JSON. |
| Edición / versiones | Parcial o ausente | El lector presenta páginas y el título de audio se puede editar. No se encontró historial de versiones del manuscrito ni aprobación formal. |
| Portadas a color IA | No operativas en producción | POST /cover responde HTTP 410; la versión actual guarda `coverImage: null` y muestra portadas tipográficas. |
| Biblioteca | Parcial | IndexedDB guarda libros localmente; se muestran nueve espacios iniciales en grilla de tres columnas. No hay límite/capacidad de 100 validado ni sincronización. |
| Reproducción | Parcial | Reproducción de grabaciones guardadas y TTS del libro por páginas. No se verificó exportación de audiolibro. |
| PDF | No verificado como exportación real | No se encontró un generador de PDF de libro; compartir texto no equivale a exportar PDF. |
| EPUB | No implementado | No se encontró generador/paquetizador EPUB ni validación de estructura EPUB. |
| Amazon KDP | Enlace, no integración | El botón actual redirige a una página genérica de Amazon Books. No prepara archivos ni metadatos KDP. |
| Almacenamiento | Local solamente demostrado | IndexedDB `livra-local` v3 con stores `recordings` y `books`. No se encontró sincronización remota. |
| Backend | Parcial | Cloudflare Worker con binding Workers AI; rutas /health, /transcribe, /compose y /cover desactivado. |
| Seguridad/costos | Requiere endurecimiento | No se observa autenticación ni rate limiting en POST /transcribe y /compose. CORS responde siempre con el origen fijo de GitHub Pages incluso cuando la petición trae otro Origin. |
| Testing | Parcial | CI ejecutó validaciones estáticas, compiló APK debug y verificó ZIP/manifest/classes.dex. No hay evidencia de pruebas funcionales en un teléfono. |

## 3. Hallazgos críticos de conservación de datos

### 3.1 Grabaciones duplicadas: riesgo de pérdida en main
En `main`, al abrir la lista de grabaciones, el renderizador calcula huellas SHA-256 y elimina automáticamente los elementos con una huella repetida. Esa eliminación se produce durante la visualización, sin confirmación del usuario.

La rama `safety/preserve-recordings-20261102` cambia este comportamiento: conserva todos los elementos y marca posibles duplicados sin borrarlos. Esa rama también incorpora recuperación nativa de una grabación pendiente desde almacenamiento privado de Android, con confirmación del usuario y acuse explícito después de guardar.

**Prioridad máxima:** recuperar y revisar cuidadosamente estas mejoras antes de cualquier cambio sobre el flujo de grabación. No borrar duplicados automáticamente.

### 3.2 Recuperación Android
La rama estable mantiene el audio en memoria durante la captura y, al destruirse la Activity, detiene la captura y limpia recursos. No se encontró persistencia nativa de audio en curso para recuperar una interrupción abrupta. La rama safety agrega un archivo temporal persistente, pero aún necesita pruebas de batería baja, llamadas, cierre forzado, falta de espacio, rotación y reinicio.

### 3.3 Almacenamiento local
IndexedDB v3 conserva grabaciones y libros en el almacenamiento del origen web. Como la Activity carga GitHub Pages, la identidad/origen del WebView es esencial para conservar la misma base. No cambiar el dominio, esquema o almacenamiento sin migración y respaldo comprobados.

## 4. Ramas y trabajo previo recuperable

El repositorio contiene 13 ramas relevantes además de main. Varias están divergidas y no deben fusionarse a ciegas.

| Rama | Relación con main | Trabajo a evaluar |
|---|---:|---|
| `safety/preserve-recordings-20261102` | 5 commits adelante, 0 atrás | Recuperación de audio y preservación de duplicados. Primera prioridad. |
| `feature/livra-library-100-books` | 3 adelante, 10 atrás | Biblioteca y espacios iniciales; verificar límite real de 100. |
| `feature/livra-mobile-library-audio-upgrade` | 12 adelante, 12 atrás | Cambios móviles, audio y visuales; divergencia alta. |
| `feature/livra-4-5-library-covers` | 2 adelante, 32 atrás | Generación de portadas IA; su Worker asociado debe reconciliarse con el endpoint actualmente desactivado. |
| `design/livra-editorial-premium` | 2 adelante, 33 atrás | Cambios de diseño; evaluar componentes aislados. |
| `livra-professional-experience-49` | 10 adelante, 7 atrás | Mejoras de experiencia; comparar antes de recuperar. |
| `livra-text-edition-493` | 22 adelante, 5 atrás | Evolución de la edición texto; revisar cambios de backend y seguridad. |
| `fix/livra-text-only-book-creation-4-9-3` | 10 adelante, 5 atrás | Flujo de creación y validación de composición. |
| Otras ramas de grilla / controles | Divergidas | Revisar cambios puntuales, no fusionar ramas completas. |
| `release/libra-voz-5.0-foundation` | 7 adelante, 0 atrás | Documento de gates, versión candidata, metadatos y workflow. |

## 5. Arquitectura actual observada

- **Android:** Java + Android WebView. La app obtiene la interfaz desde `https://wordflowapp.github.io/LIVRA-/`.
- **Frontend:** `index.html`, `styles.css`, `app.js`, `sw.js`, CSS de biblioteca y portadas tipográficas.
- **Datos locales:** IndexedDB `livra-local` v3; stores `recordings` y `books`.
- **Audio nativo:** AudioRecord PCM 16 kHz mono, puente JavaScript, SpeechRecognizer y Text-to-Speech.
- **Backend:** `https://livra-transcription.talitaescuela.workers.dev`.
- **Worker:** binding `AI`; Whisper para transcripción y `@cf/meta/llama-3.3-70b-instruct-fp8-fast` para composición.
- **Cloudflare:** se confirmó la existencia y el despliegue del Worker `livra-transcription`, con último despliegue inspeccionado el 2 de noviembre de 2026. Su configuración observada incluye solo el binding AI. No se pudo auditar D1 ni R2 porque la conexión autorizada no tiene los permisos de lectura requeridos. No se debe inferir que no existan recursos: su estado queda **no verificado**.
- **Claves:** el cliente no muestra una clave de proveedor IA; Workers AI se invoca mediante binding del servidor.

## 6. Riesgos técnicos prioritarios

1. **Pérdida de material:** eliminación automática de grabaciones duplicadas y falta de recuperación nativa en main.
2. **Falso indicador de disponibilidad:** el botón de portada puede sugerir una función que el Worker responde con 410.
3. **Exposición a abuso/costos:** endpoints de IA sin autenticación/rate limiting observado; revisar límites por usuario, tamaño, cuota y telemetría antes de ampliar uso.
4. **CORS permisivo/incorrecto:** el encabezado Access-Control-Allow-Origin devuelve el dominio fijo aun para orígenes distintos; corregir validación explícita y responder sin autorización a orígenes no permitidos.
5. **Dependencia de conexión:** la APK no contiene el frontend; depende de la web remota y del service worker para caché posterior.
6. **Compatibilidad:** la captura nativa requiere API 33 en su implementación actual; el minSdk 26 de main no refleja esa restricción. La candidata 5.0 se alineó a minSdk 33, lo que excluye Android 12 y anteriores hasta que exista una ruta alternativa probada.
7. **Monolito frontend:** `app.js` concentra almacenamiento, audio, transcripción, composición, biblioteca y lectura; conviene separar módulos de forma gradual, sin reescritura total.
8. **Pruebas insuficientes:** la CI no verifica comportamiento real de micrófono, llamadas, persistencia, UI, exports ni publicación.

## 7. KDP: requisitos de producto que deben contemplarse

La documentación oficial de KDP indica que el autor debe preparar y subir manuscrito y cubierta, completar detalles del libro, derechos/precio y revisar el resultado. Para eBooks de texto, KDP recomienda formatos ajustables como EPUB/DOCX/KPF y sugiere validar con Kindle Previewer. Para impresión, el manuscrito y la cubierta son archivos separados; el interior requiere tamaño final, márgenes, sangrado y paginación; la cubierta completa depende del tamaño de corte, cantidad de páginas y lomo.

KDP exige declarar contenido generado por IA (texto, imágenes o traducciones), incluyendo portadas generadas por IA; no exige declarar contenido meramente asistido por IA. El usuario conserva la decisión de publicación y debe aprobar la declaración de contenido y derechos.

No se identificó en la documentación consultada un mecanismo público y autorizado que permita a esta aplicación publicar directamente en una cuenta KDP. El flujo seguro es generar los archivos y metadatos, validar y guiar al usuario al portal oficial para que suba y publique con su propia cuenta.

## 8. Compilación 5.0 observada

- Rama: `release/libra-voz-5.0-foundation`.
- PR borrador: #14.
- Android candidato: `versionName 5.0.0`, `versionCode 19`, `minSdk 33`.
- GitHub Actions run #165: **success**.
- Validaciones estáticas: **success**.
- Gradle assembleDebug: **success**.
- Verificación ZIP, AndroidManifest.xml y classes.dex: **success**.
- Artefacto producido: `LIBRA-VOZ-5.0.0-debug-apk`, APK debug de aproximadamente 39 KB.

**Advertencia esencial:** el artefacto es un contenedor Android WebView pequeño que carga el frontend remoto. La compilación exitosa demuestra que el paquete Android se construyó y pasó las verificaciones de archivo; no demuestra que el producto cumpla las funciones de esta misión. No se hizo instalación ni prueba física en un dispositivo. No debe tratarse como versión final lista para usuarios.

## 9. Plan de ejecución priorizado

### P0 — Integridad y recuperación
- Recuperar de forma revisada la protección de grabaciones de la rama safety.
- Eliminar la eliminación automática de duplicados; usar detección no destructiva.
- Persistir audio durante grabación nativa y recuperar al reiniciar.
- Confirmar guardado durable antes de borrar cualquier archivo temporal.
- Mantener migraciones y respaldo de IndexedDB.

### P1 — Arquitectura de voz
- Separar máquina de estados de grabación y canal de comandos.
- Incorporar activación explícita de modo comando (pulsar para hablar / “Hola Libra” solo si el comportamiento de escucha y permisos es fiable).
- No enviar comandos al manuscrito; confirmar acciones destructivas y cambios editoriales.
- Fallback táctil en todas las acciones.

### P2 — Experiencia mobile
- Rediseñar home con Crear libro, Mi biblioteca y Mi voz.
- Una acción principal por pantalla, controles accesibles, indicadores y estados claros.
- Mantener diseño vertical y probar diferentes densidades/tamaños Android.

### P3 — Flujo editorial
- Composición estructurada: título, subtítulo, resumen comercial, prólogo, introducción cuando proceda, índice, capítulos, conclusión y epílogo opcional.
- Preguntas aclaratorias cuando falten datos; citas/fuentes cuando el libro lo requiera.
- Edición por voz y texto con historial/versionado inmutable.
- Estados de borrador, edición, revisión, aprobado y publicado.
- Aprobación explícita antes de exportar/publicar.

### P4 — Portadas y biblioteca
- Restaurar generación de portadas a color solo después de validar proveedor, costos, cuota, almacenamiento y derechos.
- Diseñar una portada editorial real con tipografía y composición consistente.
- Aplicar límite de 100 libros y vista inicial 3x3 con scroll; conservar portadas, audios, transcripciones y revisiones.

### P5 — Exportación y KDP
- Generar EPUB reflowable con estructura, metadatos, portada, navegación y validación.
- Generar PDF de impresión según tamaño de corte, márgenes, sangrado, tipografías e imágenes.
- Generar cubierta completa según páginas/lomo.
- Preparar metadatos y guía de carga manual en KDP; no automatizar publicación sin API autorizada.

### P6 — Seguridad, costos y operación
- Autorización, rate limits, cuotas, límites de duración/tamaño, controles de abuso y manejo de errores.
- Verificar permisos y recursos cloud (D1/R2/KV) con acceso de solo lectura apropiado antes de decidir arquitectura.
- Medir costos por transcripción, composición y generación de imágenes.
- Mantener secretos exclusivamente en el servidor.

### P7 — QA y release
- Tests automatizados de lógica y exportaciones.
- Pruebas Android reales: llamadas, bloqueo, rotación, cierre forzado, reinicio, batería baja, modo avión, pérdida de red, poco almacenamiento y recuperación.
- Pruebas de lectura, audio, dictado, comandos y separación de canales.
- Instalar en al menos un dispositivo Android 14 y probar regresiones; documentar resultados.
- Generar APK de release firmada, verificar firma, versionado y artefactos antes de marcar 5.0 estable.

## 10. Límites de esta auditoría

Esta auditoría se basó en lectura de código, ramas, workflow y metadatos/configuración Cloudflare accesibles. No se pudo inspeccionar el contenido de D1/R2 por permisos; no se pudo probar el Worker en producción desde la herramienta disponible; no se instaló la APK en hardware; no se probó micrófono real, red, llamadas, rendimiento ni restauración. Los estados marcados como no verificados requieren pruebas antes de declararse terminados.

---
**Regla de release:** no fusionar a main, no desplegar cambios al Worker productivo, no activar servicios pagos y no publicar una APK como final hasta completar las puertas de calidad y conservación indicadas.
