package com.livra.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.content.Intent;
import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final int REQUEST_AUDIO = 2101;
    private static final String APP_URL = "https://wordflowapp.github.io/LIVRA-/";
    private WebView webView;
    private SpeechRecognizer recognizer;
    private boolean listening = false;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(6, 26, 59));
        getWindow().setNavigationBarColor(Color.rgb(6, 26, 59));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(6, 26, 59));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.addJavascriptInterface(new SpeechBridge(), "LIVRAAndroidSpeech");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(android.webkit.PermissionRequest request) {
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
                        request.grant(request.getResources());
                    else request.deny();
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
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO);
        else webView.loadUrl(APP_URL);
    }

    private class SpeechBridge {
        @JavascriptInterface public void start() { runOnUiThread(() -> startNativeRecognition()); }
        @JavascriptInterface public void stop() { runOnUiThread(() -> stopNativeRecognition()); }
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
        String safeType = type.replace("\\", "\\\\").replace("'", "\\'");
        String safeValue = value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ");
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(
                "window.LIVRAOnNativeSpeech && window.LIVRAOnNativeSpeech('" + safeType + "','" + safeValue + "')", null);
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

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQUEST_AUDIO && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED)
            webView.loadUrl(APP_URL);
        else if (requestCode == REQUEST_AUDIO)
            Toast.makeText(this, "Sin permiso de micrófono, LIVRA no puede transcribir.", Toast.LENGTH_LONG).show();
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        stopNativeRecognition();
        if (webView != null) { webView.removeJavascriptInterface("LIVRAAndroidSpeech"); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
