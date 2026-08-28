function renderFillInTheBlankSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section fillintheblank";
  wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;

  section.questions.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box"; // Add box around each question

    const row = document.createElement("div");
    row.className = "fib-row";

    const prompt = document.createElement("p");
    prompt.innerHTML = q.prompt.replace(/___/g, `<input type="text" class="fib-input" data-section="${section._sectionIndex}" data-question="${idx}"/>`);
    row.appendChild(prompt);

    questionBox.appendChild(row); // Wrap question in box
    wrapper.appendChild(questionBox);
  });

  return wrapper;
}