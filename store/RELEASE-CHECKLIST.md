# Mu 1.0.0 — release checklist

## Build (done)
- [x] `release/Mu-1.0.1.aab` — upload this to Play Console (signed, package **mu.cryptdox.com**, versionCode 2, versionName 1.0.1)
- [x] `release/Mu-1.0.1.apk` — signed APK for direct installs / testing
- App loads **https://mu.cryptdox.com**; signing key: `android/mumu-release.jks` + `android/keystore.properties`

## Before uploading — required
- [ ] **Point mu.cryptdox.com at the frontend** (DNS + hosting/SSL). It has no DNS record yet — the app shows nothing until it does.
- [ ] Add `https://mu.cryptdox.com` to `CORS_ORIGINS` of mumu-backend, and to the Turnstile widget's hostnames (IAM captcha).
- [ ] Deploy the latest backend + frontend (account deletion, privacy pages).
- [ ] **Back up the signing key** (`mumu-release.jks` + `keystore.properties`) somewhere safe and private. Lose it = no updates.
- [ ] **Deploy the latest frontend to Netlify** — the live site doesn't have /privacy and /account-deletion yet, and Play checks these links.
- [ ] Check https://mu.cryptdox.com/privacy and /account-deletion open without signing in.

## Play Console
- [ ] Create app → name, default language, App (not game), Free.
- [ ] Store listing: texts from `listing.md`, graphics from this folder.
- [ ] App content: privacy policy URL, account deletion URL, Data safety (`data-safety.md`), content rating, target audience 13+, no ads, **app access test account**.
- [ ] Use **Play App Signing** (recommended): upload the AAB; Google holds the app signing key, `mumu-release.jks` becomes your upload key.
- [ ] Release to Internal testing first → then Production.

## Next versions
Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`, then
`cd android && JAVA_HOME=~/android-studio/jbr ./gradlew bundleRelease assembleRelease`.
Web-only changes need no new app version (the app loads the live site).
