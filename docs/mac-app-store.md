# Mac App Store Release Notes

This project includes a basic `electron-builder` setup for Mac App Store packaging.

## What is configured

- `npm run dist:mas-dev`: build a local development-signed Mac App Store package using `electron-builder.mas-dev.cjs`
- `npm run dist:mas`: build a distribution-signed `mas` package for upload
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

Then open the generated app from the `release/` directory and verify:

- image import from the system file picker
- local search and database writes
- API key save/load
- cloud analysis requests
- window icon and bundle metadata

## DMG

For direct distribution outside the App Store:

```bash
npm run dist:dmg
```

If you only want to validate the packaging flow on a machine without signing certificates:

```bash
npm run dist:dmg:unsigned
```

## App Review checklist

- Provide screenshots for macOS.
- Fill in App Privacy details for optional cloud image analysis.
- Mention in review notes that image upload only happens when users enable cloud analysis and provide their own API key.
- Do not configure an in-app auto-updater for the App Store build.
- Replace the placeholder `appId` in `package.json` with your final Bundle ID before submission.
