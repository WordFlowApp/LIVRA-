# LIBRA VOZ 5.0 — release gates

This branch is the isolated work area for the Android 5.0 release. The default `main` branch and existing feature/safety branches are intentionally untouched.

## Release identity
- Product: LIBRA VOZ
- Android application id: `com.livra.app`
- Release target: `5.0.0`
- Do not change the Android version name to 5.0.0 until the release candidate contains the integrated 5.0 implementation.

## Required release gates
- [ ] Integrate the voice-first capture, recording persistence, interruption recovery, transcription, and book-composition flow.
- [ ] Keep existing IndexedDB recordings/books readable; no destructive database reset or migration.
- [ ] Resolve the Android API compatibility gap: the current native recorder rejects Android versions below API 33 although the app declares minSdk 26.
- [ ] Confirm the library initially renders nine positions, scrolls, and supports at least 100 stored books without truncation.
- [ ] Verify book editing, chapter structure, approval, reading, and audio playback.
- [ ] Implement and verify real PDF and EPUB exports; do not describe text sharing as document export.
- [ ] Verify all network calls, CORS, secrets, cost limits, and error handling. Do not deploy Worker changes or enable paid services without separate authorization.
- [ ] Build a fresh Android APK in CI and validate the APK archive/package.
- [ ] Install and exercise the release candidate on a physical Android device, including recording interruption/recovery and app restart.
- [ ] Only after all applicable gates pass, set Android versionName to 5.0.0, increment versionCode, and publish a clearly named APK artifact.

## Known starting-point risks (from source inspection)
- The current default-branch UI identifies itself as LIVRA 4.9.4 Text Edition.
- The current Android native capture path requires API 33+, despite minSdk 26.
- The current build workflow contains assertions specifically for 4.9.4 and must be replaced/updated as part of the release work.
- A successful 5.0 APK build and physical-device test have not yet been established.

## Safety rules
- Preserve all previous branches and user data.
- Do not merge to `main` automatically.
- Do not claim a release gate passed without an actual check or test result.
