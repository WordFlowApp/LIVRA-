# LIVRA transcription backend (free-tier first)

This folder contains a Cloudflare Worker that accepts an audio upload and transcribes it with Cloudflare Workers AI's `@cf/openai/whisper` model. The model runs on Cloudflare; no OpenAI API key is embedded in the public app.

## Free usage
Cloudflare Workers AI currently includes a daily free allocation. The amount and model pricing can change, and requests stop when the free allowance is exhausted. Check the current official pricing before launch:
https://developers.cloudflare.com/workers-ai/platform/pricing/

The Worker rejects audio larger than 20 MB. Keep recordings short while testing.

## Connect and deploy (one-time account authorization required)
1. Sign in to Cloudflare and open Workers & Pages: https://dash.cloudflare.com/
2. Choose **Create application** → **Workers** → **Import a repository** (wording may vary).
3. Connect GitHub and select `WordFlowApp/LIVRA-`.
4. Set the Worker root directory to `worker`; use `wrangler deploy` as the deploy command if requested.
5. Confirm that `worker/wrangler.jsonc` is used. It defines the Workers AI binding named `AI`.
6. Deploy. Cloudflare will provide a URL similar to `https://livra-transcription.<your-subdomain>.workers.dev`.
7. Test `https://YOUR-WORKER-URL/health`; it should return JSON with `"ok": true`.

No provider API key is required for the Workers AI binding, but the Cloudflare account must be authorized and its free quota applies.

## Connect the published LIVRA app
After deployment, set `LIVRA_API_URL` in the public app's `app.js` to the Worker base URL (without `/transcribe`), for example:
`const LIVRA_API_URL = "https://livra-transcription.YOUR-SUBDOMAIN.workers.dev";`
Then commit the change. Do not put any secret or token in `app.js`.

## API
- `GET /health`: checks that the Worker is deployed.
- `POST /transcribe`: multipart form-data field `audio` containing the recording; returns `{ "text": "..." }`.

The app currently keeps recordings in the user's browser storage. Audio is only sent to the Worker after the user taps **Transcribir audio**.
