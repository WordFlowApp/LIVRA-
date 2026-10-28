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
    if (request.method !== "POST" || url.pathname !== "/transcribe") {
      return Response.json({ error: "Use POST /transcribe or GET /health" }, { status: 404, headers: cors });
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