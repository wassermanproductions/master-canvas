# Desktop Packaging

Master Canvas uses Electron for desktop packaging and Vite for the renderer build.

## Local Desktop Run

```bash
npm install
npm run desktop
```

This builds the web app and opens it in an Electron window.

## Directory Package

```bash
npm run desktop:dir
```

This creates an unpacked desktop app in `release/`. It is useful for QA before making installers.

## Installers

```bash
npm run desktop:dist
```

Electron Builder targets are configured for macOS, Windows, and Linux.

Generated artifacts are written to `release/`. On macOS this creates a `.dmg` and a `.zip` app bundle.

## macOS Signing

The development config skips macOS signing with:

```json
"identity": null
```

That is fine for local QA and open-source test builds. For public distribution where users can double-click without Gatekeeper warnings, remove that setting and sign/notarize with your Apple Developer ID.

Unsigned macOS builds can still be opened, but first-run users may need to right-click the app and choose Open, or approve it in System Settings. A signed and notarized build is the polished "download, double-click, opens normally" experience.

## Windows And Linux

Windows builds can produce an `.exe` installer and `.zip`. For a clean no-warning Windows release, sign the installer with a code-signing certificate.

Linux builds can produce an AppImage and tarball. AppImage users may need to mark the file executable before launching.

## Data Storage

The desktop app stores project data in Electron/Chromium local storage and IndexedDB on the user's machine. Nothing is uploaded to a server.
