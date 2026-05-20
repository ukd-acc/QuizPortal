function renderShortAnswerSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section shortanswer";
  wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;

  section.questions.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box"; // Add box around each question

    const row = document.createElement("div");
    row.className = "sa-row";

    const prompt = document.createElement("p");
    prompt.textContent = `${idx + 1}. ${q.prompt}`;
    row.appendChild(prompt);

    const textarea = document.createElement("textarea");
    textarea.className = "sa-input";
    textarea.dataset.question = idx; // Associate input with question index
    
    // Allow Tab/Shift+Tab key in textarea
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const spaces = "    "; // 4 spaces instead of tab
        
        if (e.shiftKey) {
          // Shift+Tab: Remove 4 spaces before cursor
          const before = textarea.value.substring(0, start);
          if (before.endsWith(spaces)) {
            textarea.value = before.substring(0, before.length - 4) + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start - 4;
          }
        } else {
          // Tab: Insert 4 spaces at cursor
          textarea.value = textarea.value.substring(0, start) + spaces + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        }
      }
    });
    
    row.appendChild(textarea);

    questionBox.appendChild(row);
    wrapper.appendChild(questionBox);
  });

  return wrapper;
}