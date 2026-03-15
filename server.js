const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CARDS_FILE = path.join(DATA_DIR, "flashcards.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });

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

async function writeCards(cards) {
  await fs.writeFile(CARDS_FILE, JSON.stringify(cards, null, 2));
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
      if (body.length > 1e6) {
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

  if (!question || !answer) {
    return { error: "Question and answer are required." };
  }

  return { question, answer, deck };
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/cards" && req.method === "GET") {
    const cards = await readCards();
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
      createdAt: new Date().toISOString(),
    };

    cards.push(newCard);
    await writeCards(cards);
    return sendJson(res, 201, newCard);
  }

  if (url.pathname.startsWith("/api/cards/")) {
    const cardId = url.pathname.split("/").pop();
    const cards = await readCards();
    const cardIndex = cards.findIndex((card) => card.id === cardId);

    if (cardIndex === -1) {
      return sendJson(res, 404, { error: "Card not found." });
    }

    if (req.method === "PUT") {
      const payload = await parseBody(req);
      const update = sanitizeCard(payload);

      if (update.error) {
        return sendJson(res, 400, { error: update.error });
      }

      cards[cardIndex] = {
        ...cards[cardIndex],
        ...update,
      };

      await writeCards(cards);
      return sendJson(res, 200, cards[cardIndex]);
    }

    if (req.method === "DELETE") {
      const [removedCard] = cards.splice(cardIndex, 1);
      await writeCards(cards);
      return sendJson(res, 200, removedCard);
    }
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
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
