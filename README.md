# Flashcard App

A lightweight flashcard study app built with plain Node.js, HTML, CSS, and browser-side JavaScript. The app stores everything locally on disk, so it can be cloned, started, and used without a database or external services.

It supports creating, editing, searching, filtering, and deleting flashcards, attaching pasted images, and keeping a separate note for each card. Notes and images are stored alongside the card data inside the repository's `data/` directory.

## Features

- Create and edit flashcards with a deck, question, answer, and optional image
- Paste images directly into the question field
- Reveal answers by clicking a card
- Search cards by deck, question, or answer text
- Filter cards by deck
- Open a per-card note in a centered modal
- Autosave notes when clicking outside the note modal
- View attached images in a lightbox overlay
- Delete a single card with confirmation
- Delete all cards in a selected deck with confirmation
- Delete all cards in the app with confirmation
- Store all data locally in JSON and text files

## Tech Stack

- Node.js built-in `http`, `fs/promises`, `path`, and `crypto`
- No frontend framework
- No database
- No npm dependencies

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
|-- server.js
|-- package.json
|-- README.md
```

## Requirements

- Node.js 18+ recommended

The project does not rely on third-party packages, so there is no dependency installation step beyond cloning the repository.

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd "ATSC 113"
```

### 2. Start the app

```bash
npm start
```

By default, the server runs at:

```text
http://localhost:3000
```

### 3. Open the app in your browser

Visit `http://localhost:3000` after the server starts.

## Configuration

The app uses the following environment variable:

- `PORT`
  Sets the HTTP port for the server. Defaults to `3000`.

Example:

```bash
PORT=4000 npm start
```

On PowerShell:

```powershell
$env:PORT=4000
npm start
```

## How Data Is Stored

This app is file-backed and writes data directly into the repository.

### Flashcards

Flashcards are stored in:

```text
data/flashcards.json
```

Each card includes:

- `id`
- `deck`
- `question`
- `answer`
- `image`
- `createdAt`

### Notes

Each flashcard note is stored as its own text file in:

```text
data/notes/
```

Each note filename matches the flashcard id:

```text
data/notes/<card-id>.txt
```

### Images

Pasted card images are written to:

```text
data/photos/
```

The flashcard stores the image path, and the server serves those files at `/photos/...`.

## First Run Behavior

On first start, the server creates the following directories if they do not already exist:

- `data/`
- `data/notes/`
- `data/photos/`

If `data/flashcards.json` does not exist, the app seeds it with a small sample set of flashcards.

## Usage Guide

### Create a flashcard

1. Enter a deck name.
2. Enter a question.
3. Enter an answer.
4. Optionally paste an image into the question field.
5. Click `Save card`.

### Edit a flashcard

1. Click the edit icon on a card.
2. Update the fields in the form.
3. Click `Update card`.

### View an answer

Click a flashcard to toggle its revealed state.

### Search and filter

- Use the search box to search across deck, question, and answer text.
- Use the deck dropdown to limit the visible cards to one deck.

### Add or edit a note

1. Click the note icon on a card.
2. Type into the lined notepad modal.
3. Click outside the modal to autosave and close it.

### View an attached image

Click the image thumbnail on a flashcard to open it in a centered lightbox.

### Delete actions

All delete actions require confirmation.

- Delete one flashcard from its card controls
- Delete all flashcards in the currently selected deck
- Delete all flashcards in the entire app

Deleting a card also deletes:

- its note file
- its saved image, if present

## API Overview

The app serves a small HTTP API used by the frontend.

### Cards

- `GET /api/cards`
  Returns all flashcards.

- `POST /api/cards`
  Creates a new flashcard.

- `PUT /api/cards/:id`
  Updates an existing flashcard.

- `DELETE /api/cards/:id`
  Deletes a single flashcard and its related assets.

- `DELETE /api/cards`
  Deletes all flashcards.

- `DELETE /api/cards?deck=<deck-name>`
  Deletes all flashcards in the specified deck.

### Notes

- `GET /api/cards/:id/note`
  Returns the note for a flashcard.

- `PUT /api/cards/:id/note`
  Saves the note for a flashcard.

### Static Assets

- `/`
  Serves the app UI

- `/photos/<filename>`
  Serves saved pasted images

## Notes on Behavior

- Question and answer are required when saving a card.
- Deck defaults to `General` if left empty.
- Image uploads are paste-only in the current UI.
- Notes are saved independently from flashcards.
- Deleting a card or bulk deleting cards removes associated notes and images from disk.
- The app is designed for local, single-user use and does not include authentication.

## Development Notes

This is a minimal project with no build step. To modify the app:

- Update `server.js` for server/API behavior
- Update `public/index.html` for markup
- Update `public/app.js` for client behavior
- Update `public/styles.css` for presentation

## Troubleshooting

### The app does not start

- Confirm Node.js is installed
- Confirm the chosen port is not already in use
- Start the app with `npm start`

### Notes or images are missing

- Check that the server has write access to `data/`
- Confirm `data/notes/` and `data/photos/` exist
- Verify the flashcard was not deleted, since deletes also remove related assets

### The browser does not show updates

- Refresh the page
- Check the terminal running `npm start` for server errors
