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

let cards = [];

function setStatus(message) {
  statusEl.textContent = message;
}

function resetForm() {
  questionInput.value = "";
  answerInput.value = "";
  cardIdInput.value = "";
  saveButton.textContent = "Save card";
}

function fillForm(card) {
  cardIdInput.value = card.id;
  deckInput.value = card.deck;
  questionInput.value = card.question;
  answerInput.value = card.answer;
  saveButton.textContent = "Update card";
  questionInput.focus();
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

    deckEl.textContent = card.deck;
    questionEl.textContent = card.question;
    answerEl.textContent = card.answer;

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

fetchCards().catch((error) => {
  console.error(error);
  setStatus("Failed to load cards.");
});
