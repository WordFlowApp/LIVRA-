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
        const prompt = "Create a beautiful, professional, literary book cover illustration inspired by this personal story. Theme: " + title + ". Story: " + source + ". Premium bookstore cover art, emotionally resonant editorial illustration, clear central metaphor, cinematic lighting, refined deep blue and warm gold palette, portrait 2:3 composition. No text, letters, typography, logos, watermark, or mockup. One standalone illustration only.";
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
          "Sos una escritora y editora literaria profesional en español rioplatense. Tu trabajo NO es transcribir ni resumir: es convertir el material hablado en un libro breve, atractivo y publicable, con voz narrativa, escenas claras, ritmo, sensibilidad, humor o emoción cuando el material lo permita.",
          "Transformá muletillas, repeticiones, frases cortadas y errores de reconocimiento en prosa natural, fluida y elegante. Reordená las ideas para que exista un comienzo que enganche, un desarrollo y un cierre satisfactorio. Usá recursos literarios, imágenes y transiciones con moderación y buen gusto, siempre apoyados en lo que el autor contó.",
          "Conservá la verdad central, las experiencias, los nombres y los hechos que aparecen en la fuente. No inventes sucesos concretos, personas, diálogos citados, fechas, lugares ni recuerdos. Podés mejorar la forma de narrar y expresar emociones implícitas de manera prudente, sin atribuir hechos nuevos. Si el material es una reflexión o una prueba técnica, convertí eso en un ensayo o crónica personal interesante; no finjas que es una aventura distinta.",
          "Creá un título literario potente y un subtítulo que prometa el tema real del libro. El resumen debe ser una sinopsis editorial atractiva. El prólogo debe tener contenido específico derivado de la fuente, nunca una plantilla genérica. Desarrollá capítulos con títulos expresivos y texto sustancial; para una fuente corta, hacé una pieza breve y redonda en vez de agregar páginas vacías o relleno. No repitas el mismo texto en resumen, prólogo y capítulos.",
          "Devolvé SOLO JSON válido, sin Markdown ni comentarios, con esta estructura exacta: {\"title\":\"...\",\"subtitle\":\"...\",\"summary\":\"...\",\"prologue\":\"...\",\"chapters\":[{\"title\":\"...\",\"text\":\"...\"}]}",
          "Antes de responder, verificá que cada campo sea texto simple, que cada capítulo tenga un título y texto real, que no haya marcadores genéricos y que el resultado esté claramente mejor escrito que la transcripción original.",
          "Título de referencia, solo si resulta útil: " + requestedTitle,
          "TRANSCRIPCIÓN ORIGINAL (fuente de verdad):\n" + source
        ].join("\n\n");
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: "Sos una autora y editora literaria profesional. Transformá la fuente en una obra bien narrada, fiel a los hechos y sin relleno. Respondé únicamente JSON válido con todos los campos de texto como strings." },
            { role: "user", content: prompt }
          ],
          max_tokens: 7000,
          temperature: 0.65
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
        return Response.json({ title: title.slice(0, 180), subtitle: subtitle.slice(0, 240), summary, prologue, chapters, model: "@cf/meta/llama-3.1-8b-instruct" }, { headers: cors });
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