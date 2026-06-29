/* ---------- MATCHING SECTION (dropdown only) ---------- */
function renderMatchingSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "matching-section";
  wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;

  // Sort the word bank alphabetically by text
  const sortedWordBank = section.word_bank.sort((a, b) => a.text.localeCompare(b.text));

  section.prompts.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box"; // Add box around each question    const row = document.createElement("div");
    
    const row = document.createElement("div");
    row.className = "prompt-row";

    const text = document.createElement("div");
    text.className = "prompt-text";
    text.textContent = `${idx + 1}. ${q.question}`;

    const selectWrapper = document.createElement("div");
    selectWrapper.className = "answer-select";

    const select = document.createElement("select");
    select.innerHTML = `<option value="">-- Select --</option>` +
      sortedWordBank.map(opt => `<option value="${opt.text}">${opt.text}</option>`).join("");

    select.addEventListener("change", () => {
      state.answers[`matching-${section._sectionIndex}-${idx}`] = select.value;
    });

    selectWrapper.appendChild(select);
    row.appendChild(text);
    row.appendChild(selectWrapper);
    questionBox.appendChild(row); // Wrap question in box
    wrapper.appendChild(questionBox);
  });

  return wrapper;
}


// Enable drag & drop by binding events to word bank tiles
function enableDnD() {
  qsa(".tile").forEach(tile => {
    tile.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", tile.dataset.letter);
      tile.classList.add("dragging");
    });
    tile.addEventListener("dragend", () => tile.classList.remove("dragging"));
  });
}
