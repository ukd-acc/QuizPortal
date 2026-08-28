/* ---------- TRUE/FALSE SECTION ---------- */
// render-tf.js
function renderTFSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section truefalse";
  wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;

  section.questions.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box"; // Add box around each question

    const row = document.createElement("div");
    row.className = "tf-row";

    // Question text
    const text = document.createElement("div");
    text.textContent = `${idx + 1}. ${q.question}`;

    // Answers container
    const answers = document.createElement("div");
    answers.className = "answers";

    // True option
    const trueDiv = document.createElement("div");
    trueDiv.className = "tf-option";
    trueDiv.textContent = "True";
    trueDiv.onclick = () => {
      answers.querySelectorAll(".tf-option").forEach(opt =>
        opt.classList.remove("selected")
      );
      trueDiv.classList.add("selected");
      state.answers[`tf-${section._sectionIndex}-${idx}`] = true;
    };

    // False option
    const falseDiv = document.createElement("div");
    falseDiv.className = "tf-option";
    falseDiv.textContent = "False";
    falseDiv.onclick = () => {
      answers.querySelectorAll(".tf-option").forEach(opt =>
        opt.classList.remove("selected")
      );
      falseDiv.classList.add("selected");
      state.answers[`tf-${section._sectionIndex}-${idx}`] = false;
    };

    answers.appendChild(trueDiv);
    answers.appendChild(falseDiv);

    row.appendChild(text);
    row.appendChild(answers);
    //questionBox.appendChild(row); // Wrap question in box
    wrapper.appendChild(row);
  });

  return wrapper;
}
