/* ---------- MULTIPLE CHOICE SECTION ---------- */
function renderMCSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section multiplechoice";
  wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;

  section.prompts.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box"; // Add box around each question

    const div = document.createElement("div");
    div.className = "mc-row"; // Ensure this wraps all options

    const questionEl = document.createElement("p");
    questionEl.textContent = `${idx + 1}. ${q.question}`;
    div.appendChild(questionEl);

    // If there's a code snippet, display it in a code block
    if (q.code) {
      const codeBlock = document.createElement("pre");
      codeBlock.className = "mc-code-block";
      const codeEl = document.createElement("code");
      codeEl.textContent = q.code;
      codeBlock.appendChild(codeEl);
      div.appendChild(codeBlock);
    }

    q.answers.forEach(ans => {
      const option = document.createElement("div");
      option.className = "mc-option";
      option.textContent = ans;

      option.onclick = () => {
        // clear previous selection for this question
        div.querySelectorAll(".mc-option").forEach(opt => 
          opt.classList.remove("selected")
        );

        // highlight the clicked one
        option.classList.add("selected");

        // save answer
        state.answers[`mc-${section._sectionIndex}-${idx}`] = ans;
      };

      div.appendChild(option);
    });

    questionBox.appendChild(div); // Wrap question in box
    wrapper.appendChild(questionBox);
  });

  return wrapper;
}

