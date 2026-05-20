/* ---------- CODE BLOCKS MULTIPLE CHOICE SECTION ---------- */
function renderCodeBlocksMCSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section code-blocks-mc";
  wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;

  section.prompts.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box";

    const div = document.createElement("div");
    div.className = "cbmc-row";

    const questionEl = document.createElement("p");
    questionEl.className = "cbmc-question";
    questionEl.textContent = `${idx + 1}. ${q.question}`;
    div.appendChild(questionEl);

    // Display code block
    if (q.code) {
      const codeBlock = document.createElement("pre");
      codeBlock.className = "cbmc-code-block";
      const codeEl = document.createElement("code");
      codeEl.textContent = q.code;
      codeBlock.appendChild(codeEl);
      div.appendChild(codeBlock);
    }

    // Display answer options
    q.answers.forEach(ans => {
      const option = document.createElement("div");
      option.className = "cbmc-option";
      option.textContent = ans;

      option.onclick = () => {
        // Clear previous selection for this question
        div.querySelectorAll(".cbmc-option").forEach(opt => 
          opt.classList.remove("selected")
        );

        // Highlight the clicked one
        option.classList.add("selected");

        // Save answer
        state.answers[`cbmc-${idx}`] = ans;
      };

      div.appendChild(option);
    });

    questionBox.appendChild(div);
    wrapper.appendChild(questionBox);
  });

  return wrapper;
}
