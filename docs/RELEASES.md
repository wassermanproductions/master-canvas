# Release Guide

Master Canvas can be distributed as a normal desktop app through GitHub Releases.

## Quick Local Release Build

```bash
npm install
npm run desktop:dist
```

Artifacts are created in `release/`.

On macOS, this produces:

- `Master Canvas-<version>-arm64.dmg`
- `Master Canvas-<version>-arm64-mac.zip`

Users can download the DMG, open it, drag the app into Applications, and launch it like a normal desktop app.

## Important Signing Reality

Double-click app behavior has two levels:

1. **Unsigned local/test build:** works as a real desktop app, but macOS/Windows may show a security warning on first launch.
2. **Signed public build:** opens with the normal polished experience and fewer security prompts.

For public macOS releases, use an Apple Developer ID and notarization. For public Windows releases, use a code-signing certificate.

## GitHub Release Checklist

1. Update the version in `package.json`.
2. Run `npm run desktop:dist`.
3. Test the generated app locally.
4. Upload the installer artifacts from `release/` to a GitHub Release.
5. Include notes that the app is local-first and stores data on the user's computer.

## Recommended Future Automation

Add a GitHub Actions release workflow after signing credentials are ready. Unsigned CI builds are possible, but signed releases are better for non-technical users.
