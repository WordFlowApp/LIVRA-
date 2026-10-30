export default {
  async fetch(request, env) {
    const allowedOrigin = "https://wordflowapp.github.io";
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origin === allowedOrigin ? allowedOrigin : allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "LIVRA transcription", model: "@cf/openai/whisper", configured: Boolean(env.AI) }, { headers: cors });
    }
    if (request.method === "POST" && url.pathname === "/cover") {
      if (!env.AI) return Response.json({ error: "Workers AI binding is not configured." }, { status: 503, headers: cors });
      try {
        const payload = await request.json();
        const title = String(payload && payload.title || "Mi historia").trim().slice(0, 160);
        const source = String(payload && payload.text || "").trim().slice(0, 1800);
        if (!source) return Response.json({ error: "Book text is required." }, { status: 400, headers: cors });
        const prompt = [
          "Create a premium, emotionally resonant FRONT-COVER ILLUSTRATION for a real book that will be sold in bookstores.",
          "Book title (for visual inspiration only; do not write it): " + title,
          "Edited book essence: " + source,
          "Understand the actual subject, people, place, atmosphere and emotional heart of this edited book. Build one memorable visual scene or poetic metaphor that clearly belongs to THIS story, never a generic stock image.",
          "Art direction: sophisticated literary publishing, beautiful painterly editorial illustration with realistic details, cinematic natural light, strong visual composition, rich but tasteful colors, subtle texture, professional art direction.",
          "Composition: vertical portrait 2:3 book-cover artwork, one dominant focal subject, elegant depth, calm negative space near the upper and lower thirds for title and author placement later. Fill the canvas edge to edge.",
          "Do not include text, letters, numbers, typography, title, author name, logo, border, frame, book mockup, hands holding a book, or watermark.",
          "The result must feel specific, moving, polished and worthy of a professionally edited book."
        ].join("\n\n");
        const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt });
        let imageBytes;
        if (result instanceof Uint8Array) {
          imageBytes = result;
        } else if (result && result.image instanceof Uint8Array) {
          imageBytes = result.image;
        } else if (result && typeof result.image === "string") {
          const binary = atob(result.image);
          imageBytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) imageBytes[i] = binary.charCodeAt(i);
        } else {
          throw new Error("AI image response was empty or unsupported");
        }
        return new Response(imageBytes, { status: 200, headers: { ...cors, "Content-Type": "image/png", "Cache-Control": "no-store" } });
      } catch (error) {
        return Response.json({ error: "No se pudo generar la tapa con IA." }, { status: 502, headers: cors });
      }
    }
    if (request.method === "POST" && url.pathname === "/compose") {
      if (!env.AI) return Response.json({ error: "Workers AI binding is not configured." }, { status: 503, headers: cors });
      try {
        const payload = await request.json();
        const source = String(payload && payload.text || "").trim();
        const requestedTitle = String(payload && payload.title || "Mi historia").trim().slice(0, 160);
        if (source.length < 80) return Response.json({ error: "La historia necesita al menos 80 caracteres para poder editarse como libro." }, { status: 400, headers: cors });
        if (source.length > 24000) return Response.json({ error: "La historia es demasiado larga para una sola edición. Dividila en grabaciones más cortas." }, { status: 413, headers: cors });
        const prompt = [
          "MISIÓN EDITORIAL: convertí una transcripción de voz en un libro breve, coherente, hermoso y legible, como lo haría una escritora profesional y una editora de una editorial seria. No entregues una transcripción corregida: entregá una OBRA LITERARIA.",
          "IDIOMA Y VOZ: español argentino/rioplatense natural, cuidado y contemporáneo. Respetá la personalidad, el vocabulario, el humor, la sensibilidad y la mirada del narrador. Evitá el tono robótico, las frases motivacionales prefabricadas, los clichés y la grandilocuencia.",
          "ETAPA 1 — COMPRENDER: identificá el tema central, quién narra, qué quiere contar, los momentos o ideas decisivas, el conflicto o pregunta que mueve el relato y el tono que mejor le corresponde. Detectá si el material es un cuento, una memoria personal, una autobiografía, una crónica, una reflexión o un ensayo. Elegí el género que realmente surge del audio.",
          "ETAPA 2 — EDITAR: corregí errores de reconocimiento de voz usando el contexto; eliminá muletillas, redundancias, falsos comienzos y frases rotas; ordená las ideas; uní ideas dispersas; mejorá ritmo, transiciones, precisión, vocabulario y puntuación. Convertí lo oral en prosa clara, expresiva y fluida. No reduzcas todo a un resumen.",
          "FIDELIDAD: la transcripción es la única fuente de verdad. Conservá nombres, relaciones, lugares, fechas, hechos y sentido. No inventes escenas, acontecimientos, personajes, diálogos textuales ni recuerdos. Reconstruí escenas solo con detalles presentes en la fuente. Si falta un dato, omitilo.",
          "ARQUITECTURA DEL LIBRO: construí un recorrido con apertura que atrape, desarrollo con progresión y cierre satisfactorio. Creá entre 2 y 6 capítulos según la cantidad y riqueza del material. Cada capítulo debe tener un propósito propio, un título atractivo y desarrollo real; no dividas artificialmente un texto corto ni repitas párrafos. Si el audio cuenta un cuento, conservá su trama y dale forma de cuento literario con escenas, tensión y desenlace. Si es una historia real, tratala como memoria o crónica, sin ficcionalizarla.",
          "PRÓLOGO — PRIORIDAD MÁXIMA: escribí un prólogo genuino, íntimamente conectado con ESTA historia. Debe nacer de una imagen, pregunta, tensión, recuerdo o idea concreta de la transcripción. Presentá al lector el corazón del libro y por qué vale la pena entrar en él, con voz literaria cálida y segura. No uses fórmulas como 'este libro es un viaje', 'en estas páginas descubrirás' ni introducciones genéricas. No inventes un episodio para hacerlo emotivo. El prólogo debe aportar una mirada editorial nueva y no repetir el resumen ni anticipar todo el contenido. Usá 3 a 5 párrafos sustanciosos cuando la fuente lo permita; si es breve, escribí uno más corto y preciso.",
          "RESUMEN: redactá una sinopsis editorial atractiva y concreta, sin revelar necesariamente el final. Describí el tema real y despertá interés. No repitas el prólogo.",
          "CAPÍTULOS: escribí prosa continua, con párrafos desarrollados, imágenes y recursos narrativos solo cuando nazcan naturalmente del material. Evitá listas, moralejas agregadas, subtítulos internos innecesarios y frases que suenen a IA. Cada capítulo debe avanzar la historia o profundizar una idea. Cerrá el libro con intención, no de golpe.",
          "TÍTULO: elegí un título literario memorable y fiel al contenido. El subtítulo debe aclarar la promesa del libro sin sonar publicitario.",
          "CONTROL DE CALIDAD: comprobá coherencia entre título, prólogo y capítulos; que el prólogo tenga detalles específicos de la fuente; que los capítulos no se repitan; que no haya datos inventados, relleno, frases genéricas, texto incompleto ni marcadores. La redacción debe sentirse escrita y editada por una persona con oficio.",
          "FORMATO: devolvé SOLO JSON válido, sin Markdown ni comentarios. El objeto debe tener las claves title, subtitle, summary, prologue y chapters; chapters debe ser un array de objetos con title y text.",
          "Título de referencia, solo si encaja: " + requestedTitle,
          "TRANSCRIPCIÓN ORIGINAL — FUENTE DE VERDAD:\n" + source
        ].join("\n\n");
        const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [
            { role: "system", content: "Sos una escritora y editora literaria de primer nivel, especializada en convertir relatos orales en libros breves y publicables en español rioplatense. Tu prioridad es la fidelidad, la calidad narrativa, un prólogo específico y capítulos con progresión. Nunca inventes hechos. Respondé únicamente JSON válido." },
            { role: "user", content: prompt }
          ],
          max_tokens: 8500,
          temperature: 0.72,
          top_p: 0.9,
          repetition_penalty: 1.08
        });
        let raw = String(result && result.response || "").trim();
        raw = raw.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
        const first = raw.indexOf("{"), last = raw.lastIndexOf("}");
        if (first >= 0 && last > first) raw = raw.slice(first, last + 1);
        const parsed = JSON.parse(raw);
        const textValue = (value) => {
          if (typeof value === "string") return value.trim();
          if (typeof value === "number") return String(value);
          if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join("\n\n");
          if (value && typeof value === "object") {
            for (const key of ["text", "content", "body", "value", "paragraph", "narrative"]) {
              if (value[key] !== undefined) { const result = textValue(value[key]); if (result) return result; }
            }
            return Object.values(value).map(textValue).filter(Boolean).join("\n\n");
          }
          return "";
        };
        const title = textValue(parsed.title);
        const subtitle = textValue(parsed.subtitle);
        const summary = textValue(parsed.summary);
        const prologue = textValue(parsed.prologue);
        if (!title || !summary || !prologue || !Array.isArray(parsed.chapters) || !parsed.chapters.length) throw new Error("Invalid book structure");
        const chapters = parsed.chapters.slice(0, 8).map((ch) => ({
          title: textValue(ch && ch.title) || "Capítulo",
          text: textValue(ch && (ch.text ?? ch.content ?? ch.body))
        })).filter(ch => ch.text && ch.text !== "[object Object]");
        if (!chapters.length) throw new Error("No valid chapters returned");
        return Response.json({ title: title.slice(0, 180), subtitle: subtitle.slice(0, 240), summary, prologue, chapters, model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }, { headers: cors });
      } catch (error) {
        return Response.json({ error: "No se pudo editar el libro con IA. Probá otra vez; tu grabación original sigue guardada." }, { status: 502, headers: cors });
      }
    }
    if (request.method !== "POST" || url.pathname !== "/transcribe") {
      return Response.json({ error: "Use POST /transcribe, POST /compose or GET /health" }, { status: 404, headers: cors });
    }
    if (!env.AI) return Response.json({ error: "Workers AI binding is not configured." }, { status: 503, headers: cors });
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 20 * 1024 * 1024) return Response.json({ error: "Audio too large. Please use a shorter recording (max 20 MB)." }, { status: 413, headers: cors });
    try {
      const form = await request.formData();
      const audio = form.get("audio");
      if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "Audio file is missing." }, { status: 400, headers: cors });
      if (audio.size > 20 * 1024 * 1024) return Response.json({ error: "Audio too large. Maximum is 20 MB." }, { status: 413, headers: cors });
      const buffer = await audio.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const batch = 0x8000;
      for (let i = 0; i < bytes.length; i += batch) binary += String.fromCharCode(...bytes.subarray(i, i + batch));
      const result = await env.AI.run("@cf/openai/whisper", { audio: btoa(binary) });
      const transcript = (result && typeof result.text === "string" ? result.text : "").trim();
      if (!transcript) return Response.json({ error: "No speech was detected. Try a clearer or longer recording." }, { status: 422, headers: cors });
      return Response.json({ text: transcript, model: "@cf/openai/whisper" }, { headers: cors });
    } catch (error) {
      return Response.json({ error: "Transcription failed. Please retry with a shorter audio recording." }, { status: 500, headers: cors });
    }
  }
};