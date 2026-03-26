# Mac App Store Release Notes

This project includes a basic `electron-builder` setup for Mac App Store packaging.

## What is configured

- `npm run dist:mas-dev`: build a local development-signed universal (`x86_64 + arm64`) Mac App Store package using `electron-builder.mas-dev.cjs`
- `npm run dist:mas`: build a distribution-signed universal (`x86_64 + arm64`) `mas` package for upload
- `npm run dist:mas:ready`: build the universal MAS package, verify it, and write an upload summary to `release/mas-upload-summary.txt`
- `npm run dist:dmg`: build a DMG package for direct distribution
- `npm run icon:mac`: generate `build/icon.icns` from `build/icon-1024.png`
- `build/entitlements.mas.plist`: main app entitlements
- `build/entitlements.mas.inherit.plist`: child process entitlements
- `build/profiles/mas-dev.provisionprofile`: local Mac App Store development provisioning profile used by `dist:mas-dev`

## Before you build

1. Enroll in the Apple Developer Program.
2. Create a macOS app in App Store Connect.
3. Create a Bundle ID that matches `build.appId` in `package.json`.
4. Create signing identities in Keychain Access:
   - Apple Development
   - Apple Distribution
   - 3rd Party Mac Developer Installer
5. Create Mac App Store provisioning profiles for:
   - development (`mas-dev`)
   - distribution (`mas`)
6. Download the provisioning profiles and install them on the build machine.
7. Place a final square `1024x1024` PNG at `build/icon-1024.png`.

## Local validation

Use the development target first:

```bash
npm install
npm run icon:mac
npm run dist:mas-dev
```

Before running `npm run dist:mas-dev`, copy your installed Mac App Store development provisioning profile to `build/profiles/mas-dev.provisionprofile`. This path is local-only because the whole `build/` directory is ignored by git.

The signed development app bundle will be emitted to `release/mas-universal/InspiraDB.app`.

For `mas` and `mas-dev`, the internal `CFBundleVersion` is now generated automatically from the current UTC timestamp, so repeated uploads do not require manually editing `package.json`.

Then open the generated app from the `release/` directory and verify:

- image import from the system file picker
- folder import from the system file picker
- local search and database writes
- cloud analysis requests
- single-image export from the detail panel
- batch export from the sidebar
- export overwrite flow and metadata sidecar write
- window icon and bundle metadata

For App Review regressions, validate both:

- a clean install after removing any previous local app build
- an update-over-previous-install path that preserves existing user data

## Local data and reinstall recovery

- App data is stored under Electron `userData`.
- The current direct-distribution build defaults to `~/Library/Application Support/InspiraDB/`.
- Historical same-channel installs may have used `~/Library/Application Support/意图集/`.
- On startup, the app now checks both `InspiraDB` and `意图集` when reconnecting to an existing same-channel library.
- If automatic recovery fails, inspect:
  - `inspiradb.sqlite`
  - `library/`
  - `thumbnails/`
- This recovery flow does not move data between DMG and Mac App Store containers.

## DMG

For direct distribution outside the App Store:

```bash
npm run dist:dmg
```

If you only want to validate the packaging flow on a machine without signing certificates:

```bash
npm run dist:dmg:unsigned
```

## MAS distribution note

`npm run dist:mas` now uses `scripts/build-mas.mjs`, which delegates app signing to `electron-builder.mas.cjs` and then falls back to a local `productbuild` step to produce the final installer. It expects a local distribution profile at `build/profiles/mas.provisionprofile`.

The current verified requirement for this machine is the installer signing identity `3rd Party Mac Developer Installer`. The app bundle is signed with `Apple Distribution`, and the final `.pkg` is produced by `productbuild` using the installer certificate.

The signed distribution app bundle is emitted to `release/mas-universal/InspiraDB.app`, and the uploadable installer is emitted to `release/InspiraDB-0.2.0-universal.pkg`.

If you want a single command that both builds and verifies the upload artifact, use:

```bash
npm run dist:mas:ready
```

It will print the generated `CFBundleVersion`, verify the universal architectures and package signature, and save the final upload path to `release/mas-upload-summary.txt`.

## App Review checklist

- Provide screenshots for macOS.
- Fill in App Privacy details for optional cloud image analysis.
- Mention in review notes that image upload only happens during cloud analysis.
- Confirm export works in the MAS-signed build on a clean install and after updating over a previous build.
- Do not configure an in-app auto-updater for the App Store build.
- Replace the placeholder `appId` in `package.json` with your final Bundle ID before submission.
