package com.livra.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Toast;
import android.content.Intent;
import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final int REQUEST_AUDIO = 2101;
    private static final String APP_URL = "https://wordflowapp.github.io/LIVRA-/";
    private WebView webView;
    private SpeechRecognizer recognizer;
    private TextToSpeech livraTts;
    private volatile boolean livraTtsReady = false;
    private boolean listening = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private android.webkit.PermissionRequest pendingWebPermissionRequest;
    private static final int LIVRA_SAMPLE_RATE = 16000;
    private AudioRecord livraAudioRecord;
    private ParcelFileDescriptor[] livraAudioPipe;
    private OutputStream livraSpeechPipe;
    private ByteArrayOutputStream livraPcm;
    private Thread livraCaptureThread;
    private final AtomicBoolean livraRecording = new AtomicBoolean(false);
    private volatile boolean livraPaused = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(6, 26, 59));
        getWindow().setNavigationBarColor(Color.rgb(6, 26, 59));
        livraTts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS && livraTts != null) {
                int language = livraTts.setLanguage(new Locale("es", "AR"));
                livraTtsReady = language != TextToSpeech.LANG_MISSING_DATA && language != TextToSpeech.LANG_NOT_SUPPORTED;
                livraTts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}
                    @Override public void onDone(String id) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.LIVRAOnNativeTTSComplete && window.LIVRAOnNativeTTSComplete()", null); }); }
                    @Override public void onError(String id) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.LIVRAOnNativeTTSError && window.LIVRAOnNativeTTSError()", null); }); }
                });
            }
        });
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(6, 26, 59));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // Always load the latest deployed app code; keep IndexedDB/local storage intact.
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        webView.addJavascriptInterface(new SpeechBridge(), "LIVRAAndroidSpeech");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(android.webkit.PermissionRequest request) {
                runOnUiThread(() -> {
                    String originHost = request.getOrigin() == null ? "" : request.getOrigin().getHost();
                    if (!"wordflowapp.github.io".equals(originHost)) {
                        request.deny();
                        return;
                    }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingWebPermissionRequest = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO);
                    }
                });
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                return host == null || !host.equals("wordflowapp.github.io");
            }
        });
        setContentView(webView);
        webView.loadUrl(APP_URL);
    }

    private class SpeechBridge {
        @JavascriptInterface public void requestMicPermission() {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    notifyMicPermission(true);
                } else {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO);
                }
            });
        }
        @JavascriptInterface public void startRecording() { runOnUiThread(() -> beginLivraRecording()); }
        @JavascriptInterface public void stopRecording() { runOnUiThread(() -> finishLivraRecording()); }
        @JavascriptInterface public void pauseRecording() { livraPaused = true; }
        @JavascriptInterface public void resumeRecording() { livraPaused = false; }
        @JavascriptInterface public void start() { runOnUiThread(() -> startNativeRecognition()); }
        @JavascriptInterface public void stop() { runOnUiThread(() -> stopNativeRecognition()); }
        @JavascriptInterface public void speakText(String text) { runOnUiThread(() -> speakNativeText(text)); }
        @JavascriptInterface public void stopSpeech() { runOnUiThread(() -> { if (livraTts != null) livraTts.stop(); }); }
    }


    // Capture the microphone once, then feed the same PCM frames to the WAV file and Android speech recognition.
    private void beginLivraRecording() {
        if (Build.VERSION.SDK_INT < 33) {
            sendToPage("recordingError", "La grabación y transcripción compartida requiere Android 13 o superior.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            sendToPage("recordingError", "Permití el micrófono de LIVRA."); return;
        }
        if (livraRecording.get()) return;
        try {
            int min = AudioRecord.getMinBufferSize(LIVRA_SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) throw new IllegalStateException("AudioRecord no está disponible");
            int size = Math.max(min, 6400);
            livraAudioRecord = new AudioRecord(MediaRecorder.AudioSource.MIC, LIVRA_SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size);
            if (livraAudioRecord.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("No se pudo abrir el micrófono");
            livraAudioPipe = ParcelFileDescriptor.createPipe();
            livraSpeechPipe = new ParcelFileDescriptor.AutoCloseOutputStream(livraAudioPipe[1]);
            livraPcm = new ByteArrayOutputStream();
            livraPaused = false;
            startSpeechFromAudioPipe(livraAudioPipe[0]);
            livraAudioRecord.startRecording();
            livraRecording.set(true);
            livraCaptureThread = new Thread(() -> {
                byte[] buf = new byte[size];
                while (livraRecording.get()) {
                    if (livraPaused) { try { Thread.sleep(40); } catch (InterruptedException ignored) {} continue; }
                    int n = livraAudioRecord.read(buf, 0, buf.length);
                    if (n > 0) {
                        synchronized (livraPcm) { livraPcm.write(buf, 0, n); }
                        try { livraSpeechPipe.write(buf, 0, n); livraSpeechPipe.flush(); } catch (IOException closedPipe) { /* Keep saving audio. */ }
                    } else if (n < 0 && livraRecording.get()) { sendToPage("recordingError", "Error leyendo el micrófono."); break; }
                }
            }, "LIVRA-AudioCapture");
            livraCaptureThread.start();
            sendToPage("recordingStarted", "");
        } catch (Exception e) {
            livraRecording.set(false); cleanupLivraAudio();
            sendToPage("recordingError", e.getMessage() == null ? "No se pudo iniciar el micrófono." : e.getMessage());
        }
    }

    private void startSpeechFromAudioPipe(ParcelFileDescriptor source) {
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) { sendToPage("speechStatus", "listening"); }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float v) {}
            @Override public void onBufferReceived(byte[] b) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onError(int e) { if (livraRecording.get()) sendToPage("speechError", String.valueOf(e)); }
            @Override public void onResults(Bundle b) { sendSpeechResult(b); }
            @Override public void onPartialResults(Bundle b) { sendSpeechResult(b, true); }
            @Override public void onEvent(int e, Bundle b) {}
            @Override public void onSegmentResults(Bundle b) { sendSpeechResult(b); }
            @Override public void onEndOfSegmentedSession() {}
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-AR");
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-AR");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, source);
        i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1);
        i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT);
        i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, LIVRA_SAMPLE_RATE);
        i.putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION, RecognizerIntent.EXTRA_AUDIO_SOURCE);
        recognizer.startListening(i);
    }
    private void sendSpeechResult(Bundle b) { sendSpeechResult(b, false); }
    private void sendSpeechResult(Bundle b, boolean partial) {
        ArrayList<String> matches = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches != null && !matches.isEmpty()) sendToPage(partial ? "speechPartial" : "speechResult", matches.get(0));
    }
    private void finishLivraRecording() {
        if (!livraRecording.getAndSet(false)) return;
        try { if (livraAudioRecord != null) livraAudioRecord.stop(); } catch (Exception ignored) {}
        try { if (livraCaptureThread != null) livraCaptureThread.join(1200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        try { if (livraSpeechPipe != null) livraSpeechPipe.close(); } catch (Exception ignored) {}
        if (recognizer != null) { try { recognizer.stopListening(); } catch (Exception ignored) {} handler.postDelayed(() -> { if (recognizer != null) { recognizer.destroy(); recognizer = null; } }, 1600); }
        byte[] pcm;
        synchronized (livraPcm == null ? this : livraPcm) { pcm = livraPcm == null ? new byte[0] : livraPcm.toByteArray(); }
        byte[] wav = livraMakeWav(pcm);
        cleanupLivraAudio();
        int chunkSize = 24000, total = (wav.length + chunkSize - 1) / chunkSize;
        sendToPage("audioStart", String.valueOf(total));
        for (int p = 0; p < total; p++) {
            int start = p * chunkSize, len = Math.min(chunkSize, wav.length - start);
            byte[] chunk = new byte[len]; System.arraycopy(wav, start, chunk, 0, len);
            sendToPage("audioChunk", p + "|" + android.util.Base64.encodeToString(chunk, android.util.Base64.NO_WRAP));
        }
        sendToPage("audioEnd", String.valueOf(wav.length));
    }
    private byte[] livraMakeWav(byte[] pcm) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(pcm.length + 44); DataOutputStream d = new DataOutputStream(out);
            d.writeBytes("RIFF"); livraWriteLE(d, pcm.length + 36); d.writeBytes("WAVE"); d.writeBytes("fmt "); livraWriteLE(d, 16);
            livraWriteLEShort(d, 1); livraWriteLEShort(d, 1); livraWriteLE(d, LIVRA_SAMPLE_RATE); livraWriteLE(d, LIVRA_SAMPLE_RATE * 2);
            livraWriteLEShort(d, 2); livraWriteLEShort(d, 16); d.writeBytes("data"); livraWriteLE(d, pcm.length); d.write(pcm); d.flush(); return out.toByteArray();
        } catch (IOException e) { throw new IllegalStateException(e); }
    }
    private void livraWriteLE(DataOutputStream d, int v) throws IOException { d.writeByte(v & 255); d.writeByte((v >> 8) & 255); d.writeByte((v >> 16) & 255); d.writeByte((v >> 24) & 255); }
    private void livraWriteLEShort(DataOutputStream d, int v) throws IOException { d.writeByte(v & 255); d.writeByte((v >> 8) & 255); }
    private void cleanupLivraAudio() {
        if (livraAudioRecord != null) { try { livraAudioRecord.release(); } catch (Exception ignored) {} livraAudioRecord = null; }
        try { if (livraSpeechPipe != null) livraSpeechPipe.close(); } catch (Exception ignored) {} livraSpeechPipe = null;
        if (livraAudioPipe != null) { try { livraAudioPipe[0].close(); } catch (Exception ignored) {} try { livraAudioPipe[1].close(); } catch (Exception ignored) {} livraAudioPipe = null; }
        livraCaptureThread = null;
    }

    private void speakNativeText(String text) {
        if (livraTts == null || !livraTtsReady) {
            if (webView != null) webView.evaluateJavascript("window.LIVRAOnNativeTTSError && window.LIVRAOnNativeTTSError()", null);
            return;
        }
        String content = text == null ? "" : text.trim();
        if (content.isEmpty()) return;
        Bundle params = new Bundle();
        livraTts.speak(content, TextToSpeech.QUEUE_FLUSH, params, "LIVRA_BOOK_" + System.currentTimeMillis());
    }

    private void startNativeRecognition() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "LIVRA necesita permiso de micrófono.", Toast.LENGTH_LONG).show();
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendToPage("error", "speech_unavailable");
            return;
        }
        listening = true;
        beginListeningSession();
    }

    private void beginListeningSession() {
        if (!listening || isFinishing()) return;
        try {
            if (recognizer != null) recognizer.destroy();
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { sendToPage("status", "listening"); }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onError(int error) {
                    if (listening) handler.postDelayed(() -> { if (listening) beginListeningSession(); }, 400);
                }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) sendToPage("result", matches.get(0));
                    if (listening) handler.postDelayed(() -> { if (listening) beginListeningSession(); }, 250);
                }
                @Override public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) sendToPage("partial", matches.get(0));
                }
                @Override public void onEvent(int eventType, Bundle params) { }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-AR");
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-AR");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            recognizer.startListening(intent);
        } catch (Exception e) {
            sendToPage("error", "start_failed");
            if (listening) handler.postDelayed(() -> { if (listening) beginListeningSession(); }, 700);
        }
    }

    private void sendToPage(String type, String value) {
        String callback;
        switch (type) {
            case "recordingStarted": callback = "LIVRAOnNativeRecordingStarted"; break;
            case "recordingError": callback = "LIVRAOnNativeRecordingError"; break;
            case "speechStatus": callback = "LIVRAOnNativeSpeechStatus"; break;
            case "speechError": callback = "LIVRAOnNativeSpeechError"; break;
            case "speechPartial": callback = "LIVRAOnNativeSpeechPartial"; break;
            case "speechResult": callback = "LIVRAOnNativeSpeechResult"; break;
            case "audioStart": callback = "LIVRAOnNativeAudioStart"; break;
            case "audioChunk": callback = "LIVRAOnNativeAudioChunk"; break;
            case "audioEnd": callback = "LIVRAOnNativeAudioEnd"; break;
            default: callback = "LIVRAOnNativeSpeechStatus"; break;
        }
        String encoded = android.util.Base64.encodeToString(value.getBytes(java.nio.charset.StandardCharsets.UTF_8), android.util.Base64.NO_WRAP);
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(
                "window." + callback + " && window." + callback + "(decodeURIComponent(escape(atob('" + encoded + "'))))", null);
        });
    }

    private void stopNativeRecognition() {
        listening = false;
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) {
            try { recognizer.stopListening(); } catch (Exception ignored) { }
            recognizer.destroy();
            recognizer = null;
        }
    }

    private void notifyMicPermission(boolean granted) {
        if (webView != null) webView.evaluateJavascript(
            "window.LIVRAOnMicPermission && window.LIVRAOnMicPermission(" + granted + ")", null);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != REQUEST_AUDIO) return;
        boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (pendingWebPermissionRequest != null) {
            if (granted) pendingWebPermissionRequest.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingWebPermissionRequest.deny();
            pendingWebPermissionRequest = null;
        }
        notifyMicPermission(granted);
        if (!granted) Toast.makeText(this, "Para grabar y transcribir, permití el micrófono de LIVRA.", Toast.LENGTH_LONG).show();
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        livraRecording.set(false);
        cleanupLivraAudio();
        stopNativeRecognition();
        if (livraTts != null) { livraTts.stop(); livraTts.shutdown(); livraTts = null; livraTtsReady = false; }
        if (webView != null) { webView.removeJavascriptInterface("LIVRAAndroidSpeech"); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
