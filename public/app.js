const form = document.getElementById("card-form");
const cardIdInput = document.getElementById("card-id");
const deckInput = document.getElementById("deck");
const questionInput = document.getElementById("question");
const answerInput = document.getElementById("answer");
const resetButton = document.getElementById("reset-button");
const saveButton = document.getElementById("save-button");
const searchInput = document.getElementById("search");
const deckFilter = document.getElementById("deck-filter");
const deleteDeckButton = document.getElementById("delete-deck-button");
const deleteAllButton = document.getElementById("delete-all-button");
const cardsContainer = document.getElementById("cards");
const statusEl = document.getElementById("status");
const runtimeModeEl = document.getElementById("runtime-mode");
const template = document.getElementById("card-template");
const imagePreview = document.getElementById("image-preview");
const imagePreviewImg = document.getElementById("image-preview-img");
const removeImageButton = document.getElementById("remove-image");
const selectImageButton = document.getElementById("select-image-button");
const imageInput = document.getElementById("image-input");
const lightbox = document.getElementById("image-lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const noteLightbox = document.getElementById("note-lightbox");
const noteTextarea = document.getElementById("note-textarea");
const confirmLightbox = document.getElementById("confirm-lightbox");
const confirmTitle = document.getElementById("confirm-title");
const confirmMessage = document.getElementById("confirm-message");
const confirmCancelButton = document.getElementById("confirm-cancel");
const confirmDeleteButton = document.getElementById("confirm-delete");

const NATIVE_STORE_KEYS = {
  cards: "flashcards.native.cards.v1",
  notes: "flashcards.native.notes.v1",
  seeded: "flashcards.native.seeded.v1",
};

let cards = [];
let attachedImage = "";
const noteCache = new Map();
let activeNote = null;
let activeConfirm = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function isNativeApp() {
  if (window.Capacitor?.isNativePlatform) {
    return window.Capacitor.isNativePlatform();
  }

  return ["capacitor:", "file:"].includes(window.location.protocol);
}

function renderRuntimeMode() {
  if (!runtimeModeEl) {
    return;
  }

  runtimeModeEl.textContent = isNativeApp()
    ? "Native app mode: cards, notes, and images are stored in the Apple app sandbox."
    : "Browser mode: cards, notes, and images are served through the local Node server for Windows testing.";
}

function generateId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCardPayload(input) {
  const question = String(input.question || "").trim();
  const answer = String(input.answer || "").trim();
  const deck = String(input.deck || "General").trim() || "General";
  const image = typeof input.image === "string" ? input.image.trim() : "";

  if (!question || !answer) {
    throw new Error("Question and answer are required.");
  }

  if (
    image &&
    !image.startsWith("data:image/") &&
    !image.startsWith("/photos/")
  ) {
    throw new Error("Attached image must be a pasted or selected image.");
  }

  return { deck, question, answer, image };
}

async function parseJsonResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function readNativeJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeNativeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createSeedCards() {
  const timestamp = new Date().toISOString();
  return [
    {
      id: generateId(),
      question: "What does JSON stand for?",
      answer: "JavaScript Object Notation",
      deck: "General",
      image: "",
      createdAt: timestamp,
    },
    {
      id: generateId(),
      question: "What command starts this app on Windows?",
      answer: "npm start",
      deck: "General",
      image: "",
      createdAt: timestamp,
    },
  ];
}

function createNativeStore() {
  function ensureInitialized() {
    const seeded = window.localStorage.getItem(NATIVE_STORE_KEYS.seeded) === "1";

    if (!seeded && !window.localStorage.getItem(NATIVE_STORE_KEYS.cards)) {
      writeNativeJson(NATIVE_STORE_KEYS.cards, createSeedCards());
      writeNativeJson(NATIVE_STORE_KEYS.notes, {});
    }

    if (!window.localStorage.getItem(NATIVE_STORE_KEYS.notes)) {
      writeNativeJson(NATIVE_STORE_KEYS.notes, {});
    }

    window.localStorage.setItem(NATIVE_STORE_KEYS.seeded, "1");
  }

  function readCards() {
    ensureInitialized();
    return readNativeJson(NATIVE_STORE_KEYS.cards, []);
  }

  function writeCards(nextCards) {
    writeNativeJson(NATIVE_STORE_KEYS.cards, nextCards);
  }

  function readNotes() {
    ensureInitialized();
    return readNativeJson(NATIVE_STORE_KEYS.notes, {});
  }

  function writeNotes(nextNotes) {
    writeNativeJson(NATIVE_STORE_KEYS.notes, nextNotes);
  }

  return {
    name: "native",
    async listCards() {
      const nextCards = readCards();
      const notes = readNotes();

      return nextCards.map((card) => ({
        ...card,
        noteExists: Boolean((notes[card.id] || "").trim()),
      }));
    },
    async saveCard(payload, id) {
      const card = normalizeCardPayload(payload);
      const nextCards = readCards();

      if (id) {
        const index = nextCards.findIndex((item) => item.id === id);

        if (index === -1) {
          throw new Error("Card not found.");
        }

        nextCards[index] = {
          ...nextCards[index],
          ...card,
        };

        writeCards(nextCards);
        return nextCards[index];
      }

      const newCard = {
        id: generateId(),
        ...card,
        createdAt: new Date().toISOString(),
      };

      nextCards.push(newCard);
      writeCards(nextCards);
      return newCard;
    },
    async deleteCard(id) {
      const nextCards = readCards();
      const index = nextCards.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new Error("Card not found.");
      }

      const [removedCard] = nextCards.splice(index, 1);
      const notes = readNotes();
      delete notes[id];
      writeCards(nextCards);
      writeNotes(notes);
      return removedCard;
    },
    async deleteCards(deck) {
      const nextCards = readCards();
      const removedCards = deck
        ? nextCards.filter((card) => card.deck === deck)
        : [...nextCards];

      if (deck && removedCards.length === 0) {
        throw new Error("Deck not found.");
      }

      const remainingCards = deck
        ? nextCards.filter((card) => card.deck !== deck)
        : [];

      const notes = readNotes();
      for (const card of removedCards) {
        delete notes[card.id];
      }

      writeCards(remainingCards);
      writeNotes(notes);

      return {
        deletedCount: removedCards.length,
        deck: deck || "",
      };
    },
    async getNote(cardId) {
      const notes = readNotes();
      return { note: notes[cardId] || "" };
    },
    async saveNote(cardId, note) {
      const notes = readNotes();
      notes[cardId] = typeof note === "string" ? note : String(note || "");
      writeNotes(notes);
      return { note: notes[cardId] };
    },
  };
}

function createWebStore() {
  return {
    name: "web",
    async listCards() {
      const response = await fetch("/api/cards");
      return parseJsonResponse(response);
    },
    async saveCard(payload, id) {
      const response = await fetch(id ? `/api/cards/${id}` : "/api/cards", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return parseJsonResponse(response);
    },
    async deleteCard(id) {
      const response = await fetch(`/api/cards/${id}`, {
        method: "DELETE",
      });

      return parseJsonResponse(response);
    },
    async deleteCards(deck) {
      const url = deck
        ? `/api/cards?deck=${encodeURIComponent(deck)}`
        : "/api/cards";
      const response = await fetch(url, {
        method: "DELETE",
      });

      return parseJsonResponse(response);
    },
    async getNote(cardId) {
      const response = await fetch(`/api/cards/${cardId}/note`);
      return parseJsonResponse(response);
    },
    async saveNote(cardId, note) {
      const response = await fetch(`/api/cards/${cardId}/note`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });

      return parseJsonResponse(response);
    },
  };
}

const store = isNativeApp() ? createNativeStore() : createWebStore();

function resetForm() {
  questionInput.value = "";
  answerInput.value = "";
  cardIdInput.value = "";
  saveButton.textContent = "Save card";
  setAttachedImage("");
}

function fillForm(card) {
  cardIdInput.value = card.id;
  deckInput.value = card.deck;
  questionInput.value = card.question;
  answerInput.value = card.answer;
  saveButton.textContent = "Update card";
  setAttachedImage(card.image || "");
  questionInput.focus();
}

function setAttachedImage(imageData) {
  attachedImage = imageData || "";

  if (attachedImage) {
    imagePreviewImg.src = attachedImage;
    imagePreview.classList.remove("hidden");
    return;
  }

  imagePreviewImg.removeAttribute("src");
  imagePreview.classList.add("hidden");
}

function openLightbox(imageSrc) {
  lightboxImage.src = imageSrc;
  lightbox.classList.remove("hidden");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImage.removeAttribute("src");
}

function openConfirmModal(title, message) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmLightbox.classList.remove("hidden");
  confirmLightbox.setAttribute("aria-hidden", "false");
}

function closeConfirmModal() {
  confirmLightbox.classList.add("hidden");
  confirmLightbox.setAttribute("aria-hidden", "true");
}

function requestConfirmation(title, message) {
  if (activeConfirm) {
    activeConfirm.resolve(false);
  }

  openConfirmModal(title, message);

  return new Promise((resolve) => {
    activeConfirm = { resolve };
  });
}

function settleConfirmation(confirmed) {
  if (!activeConfirm) {
    return;
  }

  const { resolve } = activeConfirm;
  activeConfirm = null;
  closeConfirmModal();
  resolve(confirmed);
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

async function attachImageFromFile(file) {
  if (!file) {
    return;
  }

  try {
    const imageData = await readImageFile(file);
    setAttachedImage(imageData);
    setStatus("Image attached to flashcard.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function handleQuestionPaste(event) {
  const imageItem = [...event.clipboardData.items].find((item) =>
    item.type.startsWith("image/")
  );

  if (!imageItem) {
    return;
  }

  event.preventDefault();

  try {
    const file = imageItem.getAsFile();

    if (!file) {
      throw new Error("No pasted image found.");
    }

    await attachImageFromFile(file);
  } catch (error) {
    setStatus(error.message);
  }
}

function filteredCards() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedDeck = deckFilter.value;

  return cards.filter((card) => {
    const matchesDeck = !selectedDeck || card.deck === selectedDeck;
    const matchesQuery =
      !query ||
      [card.deck, card.question, card.answer].some((value) =>
        value.toLowerCase().includes(query)
      );

    return matchesDeck && matchesQuery;
  });
}

function renderDeckOptions() {
  const decks = [...new Set(cards.map((card) => card.deck))].sort((a, b) =>
    a.localeCompare(b)
  );
  const previousValue = deckFilter.value;

  deckFilter.innerHTML = '<option value="">All decks</option>';

  for (const deck of decks) {
    const option = document.createElement("option");
    option.value = deck;
    option.textContent = deck;
    deckFilter.appendChild(option);
  }

  if (decks.includes(previousValue)) {
    deckFilter.value = previousValue;
  }

  deleteDeckButton.disabled = !deckFilter.value;
}

function renderCards() {
  cardsContainer.innerHTML = "";
  const visibleCards = filteredCards();

  if (visibleCards.length === 0) {
    cardsContainer.innerHTML = '<p class="empty">No cards match your search.</p>';
    return;
  }

  for (const card of visibleCards) {
    const fragment = template.content.cloneNode(true);
    const cardEl = fragment.querySelector(".flashcard");
    const deckEl = fragment.querySelector(".deck");
    const questionEl = fragment.querySelector(".question");
    const answerEl = fragment.querySelector(".answer");
    const noteIndicator = fragment.querySelector(".note-indicator");
    const editButton = fragment.querySelector(".edit-button");
    const noteButton = fragment.querySelector(".note-button");
    const deleteButton = fragment.querySelector(".delete-button");
    const imageWrap = fragment.querySelector(".card-image-wrap");
    const imageButton = fragment.querySelector(".card-image-button");
    const imageThumb = fragment.querySelector(".card-image-thumb");

    deckEl.textContent = card.deck;
    questionEl.textContent = card.question;
    answerEl.textContent = card.answer;

    if (card.noteExists) {
      noteIndicator.classList.remove("hidden");
    }

    if (card.image) {
      imageThumb.src = card.image;
      imageWrap.classList.remove("hidden");
      imageButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openLightbox(card.image);
      });
    }

    editButton.addEventListener("click", () => fillForm(card));
    noteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleNote(card.id);
    });
    deleteButton.addEventListener("click", () => deleteCard(card.id));

    cardEl.addEventListener("click", (event) => {
      if (activeNote?.cardId === card.id) {
        return;
      }

      if (event.target.tagName === "BUTTON") {
        return;
      }

      cardEl.classList.toggle("revealed");
    });

    cardsContainer.appendChild(fragment);
  }
}

async function fetchNote(cardId) {
  if (noteCache.has(cardId)) {
    return noteCache.get(cardId);
  }

  const data = await store.getNote(cardId);
  const note = data.note || "";
  noteCache.set(cardId, note);
  return note;
}

async function persistNote(cardId, note) {
  const data = await store.saveNote(cardId, note);
  noteCache.set(cardId, data.note || "");
}

function updateCardNoteState(cardId, note) {
  const card = cards.find((item) => item.id === cardId);

  if (!card) {
    return;
  }

  card.noteExists = Boolean(note.trim());
  renderCards();
}

async function closeActiveNote({ save } = { save: true }) {
  if (!activeNote) {
    return;
  }

  const { cardId } = activeNote;
  const nextValue = noteTextarea.value;

  if (save) {
    try {
      await persistNote(cardId, nextValue);
      updateCardNoteState(cardId, nextValue);
      setStatus("Note saved.");
    } catch (error) {
      setStatus(error.message);
      return;
    }
  } else {
    noteTextarea.value = noteCache.get(cardId) || "";
  }

  noteLightbox.classList.add("hidden");
  noteLightbox.setAttribute("aria-hidden", "true");
  activeNote = null;
}

async function toggleNote(cardId) {
  if (activeNote && activeNote.cardId === cardId) {
    await closeActiveNote();
    return;
  }

  if (activeNote) {
    await closeActiveNote();
    if (activeNote) {
      return;
    }
  }

  try {
    const note = await fetchNote(cardId);
    noteTextarea.value = note;
    noteLightbox.classList.remove("hidden");
    noteLightbox.setAttribute("aria-hidden", "false");
    activeNote = { cardId };
    noteTextarea.focus();
    noteTextarea.setSelectionRange(noteTextarea.value.length, noteTextarea.value.length);
    setStatus(note ? "Note loaded." : "New note ready.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function fetchCards() {
  cards = await store.listCards();
  renderDeckOptions();
  renderCards();
  setStatus(`${cards.length} card${cards.length === 1 ? "" : "s"} loaded.`);
}

async function saveCard(event) {
  event.preventDefault();

  try {
    const payload = {
      deck: deckInput.value,
      question: questionInput.value,
      answer: answerInput.value,
      image: attachedImage,
    };
    const id = cardIdInput.value;

    await store.saveCard(payload, id);
    await fetchCards();
    resetForm();
    setStatus(id ? "Card updated." : "Card added.");
  } catch (error) {
    setStatus(error.message || "Failed to save card.");
  }
}

async function deleteCard(id) {
  const confirmed = await requestConfirmation(
    "Delete flashcard?",
    "This will permanently delete this flashcard, its note, and any attached image."
  );

  if (!confirmed) {
    setStatus("Delete canceled.");
    return;
  }

  try {
    if (activeNote?.cardId === id) {
      await closeActiveNote({ save: true });
    }

    noteCache.delete(id);
    await store.deleteCard(id);

    const wasEditing = cardIdInput.value === id;
    await fetchCards();

    if (wasEditing) {
      resetForm();
    }

    setStatus("Card deleted.");
  } catch (error) {
    setStatus(error.message || "Failed to delete card.");
  }
}

async function deleteByDeck() {
  const deck = deckFilter.value;

  if (!deck) {
    setStatus("Select a deck first to delete it.");
    return;
  }

  const confirmed = await requestConfirmation(
    "Delete this deck?",
    `This will permanently delete every flashcard in "${deck}" along with their notes and images.`
  );

  if (!confirmed) {
    setStatus("Delete canceled.");
    return;
  }

  try {
    if (activeNote) {
      await closeActiveNote({ save: true });
    }

    const wasEditingDeletedDeck = cardIdInput.value
      ? cards.some((card) => card.id === cardIdInput.value && card.deck === deck)
      : false;

    const deletedCardIds = cards
      .filter((card) => card.deck === deck)
      .map((card) => card.id);

    for (const id of deletedCardIds) {
      noteCache.delete(id);
    }

    const data = await store.deleteCards(deck);

    if (wasEditingDeletedDeck) {
      resetForm();
    }

    await fetchCards();
    setStatus(
      `${data.deletedCount} card${data.deletedCount === 1 ? "" : "s"} deleted from ${deck}.`
    );
  } catch (error) {
    setStatus(error.message || "Failed to delete deck.");
  }
}

async function deleteAllCards() {
  const confirmed = await requestConfirmation(
    "Delete all flashcards?",
    "This will permanently delete every flashcard, every note, and every attached image."
  );

  if (!confirmed) {
    setStatus("Delete canceled.");
    return;
  }

  try {
    if (activeNote) {
      await closeActiveNote({ save: true });
    }

    noteCache.clear();
    const data = await store.deleteCards("");
    resetForm();
    await fetchCards();
    setStatus(`${data.deletedCount} card${data.deletedCount === 1 ? "" : "s"} deleted.`);
  } catch (error) {
    setStatus(error.message || "Failed to delete all cards.");
  }
}

form.addEventListener("submit", saveCard);
resetButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", renderCards);
deckFilter.addEventListener("change", renderCards);
deleteDeckButton.addEventListener("click", () => {
  deleteByDeck().catch((error) => {
    console.error(error);
    setStatus("Failed to delete deck.");
  });
});
deleteAllButton.addEventListener("click", () => {
  deleteAllCards().catch((error) => {
    console.error(error);
    setStatus("Failed to delete all cards.");
  });
});
questionInput.addEventListener("paste", handleQuestionPaste);
selectImageButton.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  await attachImageFromFile(file);
  imageInput.value = "";
});
removeImageButton.addEventListener("click", () => setAttachedImage(""));
document.addEventListener("click", async (event) => {
  if (!activeNote) {
    return;
  }

  if (!noteLightbox.contains(event.target)) {
    await closeActiveNote();
  }
});
noteLightbox.addEventListener("click", async (event) => {
  if (event.target === noteTextarea || event.target.closest(".note-modal")) {
    return;
  }

  await closeActiveNote();
});
lightbox.addEventListener("click", (event) => {
  if (event.target !== lightboxImage) {
    closeLightbox();
  }
});
confirmCancelButton.addEventListener("click", () => settleConfirmation(false));
confirmDeleteButton.addEventListener("click", () => settleConfirmation(true));
confirmLightbox.addEventListener("click", (event) => {
  if (!event.target.closest(".confirm-modal")) {
    settleConfirmation(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeConfirm) {
    settleConfirmation(false);
    return;
  }

  if (event.key === "Escape" && activeNote) {
    closeActiveNote().catch((error) => {
      console.error(error);
      setStatus("Failed to save note.");
    });
    return;
  }

  if (event.key === "Escape" && !lightbox.classList.contains("hidden")) {
    closeLightbox();
  }
});

renderRuntimeMode();
fetchCards().catch((error) => {
  console.error(error);
  setStatus("Failed to load cards.");
});
