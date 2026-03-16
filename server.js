const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const NOTES_DIR = path.join(DATA_DIR, "notes");
const PHOTOS_DIR = path.join(DATA_DIR, "photos");
const CARDS_FILE = path.join(DATA_DIR, "flashcards.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(NOTES_DIR, { recursive: true });
  await fs.mkdir(PHOTOS_DIR, { recursive: true });

  try {
    await fs.access(CARDS_FILE);
  } catch {
    const seedCards = [
      {
        id: randomUUID(),
        question: "What does JSON stand for?",
        answer: "JavaScript Object Notation",
        deck: "General",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        question: "What command starts this app?",
        answer: "npm start",
        deck: "General",
        createdAt: new Date().toISOString(),
      },
    ];

    await fs.writeFile(CARDS_FILE, JSON.stringify(seedCards, null, 2));
  }
}

async function readCards() {
  const raw = await fs.readFile(CARDS_FILE, "utf8");
  return JSON.parse(raw);
}

async function readCardsWithNoteState() {
  const cards = await readCards();
  const cardsWithNotes = await Promise.all(
    cards.map(async (card) => ({
      ...card,
      noteExists: Boolean((await readNote(card.id)).trim()),
    }))
  );

  return cardsWithNotes;
}

async function writeCards(cards) {
  await fs.writeFile(CARDS_FILE, JSON.stringify(cards, null, 2));
}

function noteFilePath(cardId) {
  return path.join(NOTES_DIR, `${cardId}.txt`);
}

async function readNote(cardId) {
  try {
    return await fs.readFile(noteFilePath(cardId), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function writeNote(cardId, note) {
  await fs.writeFile(noteFilePath(cardId), note, "utf8");
}

async function deleteNote(cardId) {
  try {
    await fs.unlink(noteFilePath(cardId));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5e6) {
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sanitizeCard(input) {
  const question = String(input.question || "").trim();
  const answer = String(input.answer || "").trim();
  const deck = String(input.deck || "General").trim() || "General";
  const image = typeof input.image === "string" ? input.image.trim() : "";

  if (!question || !answer) {
    return { error: "Question and answer are required." };
  }

  if (
    image &&
    !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image) &&
    !image.startsWith("/photos/")
  ) {
    return { error: "Attached image must be a valid pasted image." };
  }

  return { question, answer, deck, image };
}

function sanitizeNote(input) {
  return typeof input.note === "string" ? input.note : String(input.note || "");
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Attached image must be a valid pasted image.");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extensionFromMimeType(mimeType) {
  const extensions = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
  };

  return extensions[mimeType] || ".png";
}

function imageFilePathFromUrl(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/photos/")) {
    return null;
  }

  return path.join(PHOTOS_DIR, path.basename(imageUrl));
}

async function saveImage(imageValue) {
  if (!imageValue || !imageValue.startsWith("data:image/")) {
    return imageValue || "";
  }

  const { mimeType, buffer } = parseDataUrl(imageValue);
  const filename = `${randomUUID()}${extensionFromMimeType(mimeType)}`;
  const filePath = path.join(PHOTOS_DIR, filename);

  await fs.writeFile(filePath, buffer);
  return `/photos/${filename}`;
}

async function deleteImage(imageUrl) {
  const filePath = imageFilePathFromUrl(imageUrl);

  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function deleteCardAssets(card) {
  await deleteImage(card.image);
  await deleteNote(card.id);
}

async function removeCards(cardsToRemove) {
  await Promise.all(cardsToRemove.map((card) => deleteCardAssets(card)));
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/cards" && req.method === "GET") {
    const cards = await readCardsWithNoteState();
    return sendJson(res, 200, cards);
  }

  if (url.pathname === "/api/cards" && req.method === "POST") {
    const payload = await parseBody(req);
    const card = sanitizeCard(payload);

    if (card.error) {
      return sendJson(res, 400, { error: card.error });
    }

    const cards = await readCards();
    const newCard = {
      id: randomUUID(),
      ...card,
      image: await saveImage(card.image),
      createdAt: new Date().toISOString(),
    };

    cards.push(newCard);
    await writeCards(cards);
    return sendJson(res, 201, newCard);
  }

  if (url.pathname === "/api/cards" && req.method === "DELETE") {
    const deck = (url.searchParams.get("deck") || "").trim();
    const cards = await readCards();
    const removedCards = deck
      ? cards.filter((card) => card.deck === deck)
      : [...cards];

    if (deck && removedCards.length === 0) {
      return sendJson(res, 404, { error: "Deck not found." });
    }

    const remainingCards = deck
      ? cards.filter((card) => card.deck !== deck)
      : [];

    await writeCards(remainingCards);
    await removeCards(removedCards);

    return sendJson(res, 200, {
      deletedCount: removedCards.length,
      deck,
    });
  }

  if (url.pathname.startsWith("/api/cards/")) {
    const segments = url.pathname.split("/").filter(Boolean);
    const cardId = segments[2];
    const cards = await readCards();
    const cardIndex = cards.findIndex((card) => card.id === cardId);

    if (cardIndex === -1) {
      return sendJson(res, 404, { error: "Card not found." });
    }

    if (segments[3] === "note") {
      if (req.method === "GET") {
        const note = await readNote(cardId);
        return sendJson(res, 200, { note });
      }

      if (req.method === "PUT") {
        const payload = await parseBody(req);
        const note = sanitizeNote(payload);
        await writeNote(cardId, note);
        return sendJson(res, 200, { note });
      }
    }

    if (req.method === "PUT") {
      const payload = await parseBody(req);
      const update = sanitizeCard(payload);

      if (update.error) {
        return sendJson(res, 400, { error: update.error });
      }

      let nextImage = cards[cardIndex].image || "";

      if (update.image !== nextImage) {
        if (update.image.startsWith("data:image/")) {
          nextImage = await saveImage(update.image);
          await deleteImage(cards[cardIndex].image);
        } else if (!update.image) {
          await deleteImage(cards[cardIndex].image);
          nextImage = "";
        } else {
          nextImage = update.image;
        }
      }

      cards[cardIndex] = {
        ...cards[cardIndex],
        ...update,
        image: nextImage,
      };

      await writeCards(cards);
      return sendJson(res, 200, cards[cardIndex]);
    }

    if (req.method === "DELETE") {
      const [removedCard] = cards.splice(cardIndex, 1);
      await writeCards(cards);
      await deleteCardAssets(removedCard);
      return sendJson(res, 200, removedCard);
    }
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/photos/")) {
    const filePath = path.join(PHOTOS_DIR, path.basename(url.pathname));

    try {
      const ext = path.extname(filePath);
      const content = await fs.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }

    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const ext = path.extname(filePath);
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    const statusCode = error.message === "Invalid JSON" ? 400 : 500;
    sendJson(res, statusCode, { error: error.message || "Internal server error" });
  }
});

ensureStorage()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Flashcard app running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage:", error);
    process.exit(1);
  });
