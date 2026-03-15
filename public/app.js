const form = document.getElementById("card-form");
const cardIdInput = document.getElementById("card-id");
const deckInput = document.getElementById("deck");
const questionInput = document.getElementById("question");
const answerInput = document.getElementById("answer");
const resetButton = document.getElementById("reset-button");
const saveButton = document.getElementById("save-button");
const searchInput = document.getElementById("search");
const deckFilter = document.getElementById("deck-filter");
const cardsContainer = document.getElementById("cards");
const statusEl = document.getElementById("status");
const template = document.getElementById("card-template");
const imagePreview = document.getElementById("image-preview");
const imagePreviewImg = document.getElementById("image-preview-img");
const removeImageButton = document.getElementById("remove-image");
const lightbox = document.getElementById("image-lightbox");
const lightboxImage = document.getElementById("lightbox-image");

let cards = [];
let attachedImage = "";

function setStatus(message) {
  statusEl.textContent = message;
}

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

function readPastedImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read pasted image."));
    reader.readAsDataURL(file);
  });
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

    const imageData = await readPastedImage(file);
    setAttachedImage(imageData);
    setStatus("Image attached to flashcard.");
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
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");
    const imageWrap = fragment.querySelector(".card-image-wrap");
    const imageButton = fragment.querySelector(".card-image-button");
    const imageThumb = fragment.querySelector(".card-image-thumb");

    deckEl.textContent = card.deck;
    questionEl.textContent = card.question;
    answerEl.textContent = card.answer;

    if (card.image) {
      imageThumb.src = card.image;
      imageWrap.classList.remove("hidden");
      imageButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openLightbox(card.image);
      });
    }

    editButton.addEventListener("click", () => fillForm(card));
    deleteButton.addEventListener("click", () => deleteCard(card.id));

    cardEl.addEventListener("click", (event) => {
      if (event.target.tagName === "BUTTON") {
        return;
      }

      cardEl.classList.toggle("revealed");
    });

    cardsContainer.appendChild(fragment);
  }
}

async function fetchCards() {
  const response = await fetch("/api/cards");
  cards = await response.json();
  renderDeckOptions();
  renderCards();
  setStatus(`${cards.length} card${cards.length === 1 ? "" : "s"} loaded.`);
}

async function saveCard(event) {
  event.preventDefault();

  const payload = {
    deck: deckInput.value,
    question: questionInput.value,
    answer: answerInput.value,
    image: attachedImage,
  };

  const id = cardIdInput.value;
  const response = await fetch(id ? `/api/cards/${id}` : "/api/cards", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    setStatus(data.error || "Failed to save card.");
    return;
  }

  await fetchCards();
  resetForm();
  setStatus(id ? "Card updated." : "Card added.");
}

async function deleteCard(id) {
  const response = await fetch(`/api/cards/${id}`, { method: "DELETE" });

  if (!response.ok) {
    setStatus("Failed to delete card.");
    return;
  }

  const wasEditing = cardIdInput.value === id;
  await fetchCards();

  if (wasEditing) {
    resetForm();
  }

  setStatus("Card deleted.");
}

form.addEventListener("submit", saveCard);
resetButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", renderCards);
deckFilter.addEventListener("change", renderCards);
questionInput.addEventListener("paste", handleQuestionPaste);
removeImageButton.addEventListener("click", () => setAttachedImage(""));
lightbox.addEventListener("click", (event) => {
  if (event.target !== lightboxImage) {
    closeLightbox();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.classList.contains("hidden")) {
    closeLightbox();
  }
});

fetchCards().catch((error) => {
  console.error(error);
  setStatus("Failed to load cards.");
});
