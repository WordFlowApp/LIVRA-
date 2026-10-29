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
          "Actuá como editor literario profesional de español rioplatense (Argentina). Convertí la transcripción hablada en un libro breve, bien redactado y coherente.",
          "Reglas obligatorias: conservá el significado, los hechos, los nombres y la voz del autor; corregí errores de reconocimiento, puntuación, repeticiones y frases incompletas; reorganizá las ideas cuando ayude a la claridad; no inventes hechos, diálogos, recuerdos, fechas, lugares ni opiniones. Si falta información, omitila en vez de inventarla. No copies literalmente la transcripción. No menciones que sos una IA.",
          "Devolvé SOLO JSON válido con esta estructura exacta: {\"title\":\"...\",\"summary\":\"...\",\"prologue\":\"...\",\"chapters\":[{\"title\":\"...\",\"text\":\"...\"}]}",
          "El resumen debe ser breve y fiel. El prólogo debe presentar la obra sin agregar hechos. Organizá el contenido en 2 a 6 capítulos según la cantidad de material; cada capítulo debe desarrollar una idea con continuidad y tener un título. Si el material es corto, hacé menos capítulos y no rellenes.",
          "Título sugerido: " + requestedTitle,
          "TRANSCRIPCIÓN ORIGINAL (fuente de verdad):\n" + source
        ].join("\n\n");
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: "Sos un editor literario riguroso. La fidelidad a la fuente es prioritaria. Respondé únicamente JSON válido, sin Markdown." },
            { role: "user", content: prompt }
          ],
          max_tokens: 7000,
          temperature: 0.35
        });
        let raw = String(result && result.response || "").trim();
        raw = raw.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
        const first = raw.indexOf("{"), last = raw.lastIndexOf("}");
        if (first >= 0 && last > first) raw = raw.slice(first, last + 1);
        const parsed = JSON.parse(raw);
        if (!parsed.title || !parsed.summary || !parsed.prologue || !Array.isArray(parsed.chapters) || !parsed.chapters.length) throw new Error("Invalid book structure");
        const chapters = parsed.chapters.slice(0, 8).map(ch => ({
          title: String(ch.title || "Capítulo").slice(0, 180),
          text: String(ch.text || "").trim()
        })).filter(ch => ch.text);
        if (!chapters.length) throw new Error("No chapters returned");
        return Response.json({ title: String(parsed.title).slice(0, 180), summary: String(parsed.summary), prologue: String(parsed.prologue), chapters, model: "@cf/meta/llama-3.1-8b-instruct" }, { headers: cors });
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