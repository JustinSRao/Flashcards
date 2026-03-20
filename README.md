# Flashcards

Flashcards is now structured to run in two modes with the same UI and feature set:

- Windows browser mode: the existing Node.js server continues to serve the app and store data in the repository `data/` folder.
- Apple app mode: the frontend can be packaged with Capacitor for iPhone, iPad, and Mac, and it stores data inside the app sandbox so it does not require Node on-device.

This keeps local Windows development simple while making the project portable to iOS, iPadOS, and macOS through a single Apple-native shell.

## What Changed

- Preserved the current browser workflow with `server.js`
- Refactored the frontend to support two storage backends
- Added a native-safe storage path for Apple builds
- Added image selection from the device in addition to paste support
- Added Capacitor project configuration for Apple packaging
- Updated package scripts for Apple sync/open workflows

## Current Architecture

### Browser Mode

- Start with `npm start`
- Runs through `server.js`
- Uses:
  - `data/flashcards.json`
  - `data/notes/`
  - `data/photos/`

### Apple App Mode

- Package the `public/` directory with Capacitor
- No Node server runs on the device
- Cards, notes, and image data are stored in the app's local WebView storage
- Same UI and client behavior as browser mode

## Project Structure

```text
.
|-- data/
|   |-- flashcards.json
|   |-- notes/
|   |-- photos/
|-- public/
|   |-- app.js
|   |-- index.html
|   |-- styles.css
|-- capacitor.config.json
|-- server.js
|-- package.json
|-- README.md
```

## Requirements

### For Windows Development

- Node.js 18+ recommended
- npm 9+ recommended

### For Apple Packaging and Store Submission

Apple builds still require Apple tooling. As of March 20, 2026, you need:

- A Mac
- Xcode
- An Apple Developer account

You cannot build, sign, archive, or submit iPhone, iPad, or Mac App Store binaries from Windows alone.

## Windows Development Workflow

### 1. Install dependencies

```bash
npm install
```

### 2. Start the browser build

```bash
npm start
```

The app runs at:

```text
http://localhost:3000
```

In this mode, your flashcards continue to use the repository-backed `data/` folder.

## Apple Platform Setup

This repo is prepared for Capacitor-based Apple packaging. After pulling the latest changes onto a Mac:

### 1. Install dependencies

```bash
npm install
```

### 2. Generate the iOS project

```bash
npx cap add ios
```

You only need to run `npx cap add ios` once.

### 3. Sync web assets into the native shell

```bash
npm run cap:sync
```

### 4. Open the native project in Xcode

```bash
npm run cap:open:ios
```

### 5. Enable the Apple targets you want in Xcode

From the iOS project in Xcode:

- Build for iPhone
- Build for iPad
- Enable Mac Catalyst if you want a macOS App Store build from the same codebase

This gives you one Apple project that can target:

- iOS
- iPadOS
- macOS via Mac Catalyst

## Publishing Path

### iPhone and iPad

Use Xcode Archive and App Store Connect submission from the iOS target.

### Mac

Use Mac Catalyst in Xcode, then archive and submit the Mac build through App Store Connect.

## Available Scripts

- `npm start`
  Starts the Windows/browser development server.

- `npm run serve:web`
  Same as `npm start`.

- `npm run cap:copy`
  Copies the web assets into the iOS wrapper.

- `npm run cap:sync`
  Syncs the Capacitor iOS project.

- `npm run cap:open:ios`
  Opens the iOS project in Xcode.

## Data Behavior

### Browser Mode

- Cards are stored in `data/flashcards.json`
- Notes are stored in `data/notes/`
- Pasted images are stored in `data/photos/`

### Apple App Mode

- Cards are stored inside the app sandbox
- Notes are stored inside the app sandbox
- Images are stored inside the app sandbox
- Data does not depend on the repository's `data/` directory

## Feature Parity

The app still supports:

- Create and edit flashcards
- Search cards
- Filter by deck
- Reveal answers
- Save per-card notes
- Delete one card
- Delete one deck
- Delete all cards
- Attach images
- View images in a lightbox

The only architectural difference is where data lives depending on runtime.

## Development Notes

- `public/app.js` now selects its storage backend automatically
- In browser mode it talks to the existing Node API
- In Apple app mode it uses native-safe local storage
- `server.js` remains the Windows development server

## Important Limitation

This repository is now prepared for Apple platforms, but the final native build artifacts and App Store submission steps still must be completed on macOS with Xcode. That limitation is imposed by Apple's toolchain, not by the app code. I have not yet worked on this project from an Apple device, so this step is next TODO!
