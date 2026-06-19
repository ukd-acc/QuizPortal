/* ---------- LIKERT SCALE SECTION ---------- */
function renderLikertSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section likert";
  // Only include instructions paragraph if non-empty to avoid extra vertical gap
  wrapper.innerHTML = `<h2>${section.title}</h2>` + (section.instructions && section.instructions.trim() ? `<p>${section.instructions}</p>` : "");

  const scale = section.scale_labels || ["Not at all", "Somewhat", "Neutral", "Mostly", "Completely"];

  section.prompts.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box likert-question";

    const prompt = document.createElement("p");
    prompt.className = "likert-prompt";
    prompt.textContent = `${idx + 1}. ${q.question}`;
    questionBox.appendChild(prompt);

    const scaleRow = document.createElement("div");
    scaleRow.className = "likert-scale";

    // Create labelled radio buttons horizontally
    scale.forEach((label, sIdx) => {
      const option = document.createElement("div");
      option.className = "likert-option";

  const input = document.createElement("input");
      input.type = "radio";
      // include section index if provided to avoid name collisions
      const secIdx = typeof section._sectionIndex !== 'undefined' ? section._sectionIndex : '0';
      input.name = `likert-${secIdx}-${idx}`;
      input.value = String(sIdx);
  input.id = `likert-${secIdx}-${idx}-${sIdx}`;

  const lab = document.createElement("label");
  lab.htmlFor = input.id;
      lab.className = "likert-label";
      lab.textContent = sIdx + 1; // show numeric option above the label

      const caption = document.createElement("div");
      caption.className = "likert-caption";
      caption.textContent = label;

      // When selected, save to state
      input.addEventListener("change", () => {
        // store under a key that includes section index
        state.answers[`likert-${secIdx}-${idx}`] = {
          value: Number(input.value),
          label: label
        };
      });

      option.appendChild(input);
      option.appendChild(lab);
      option.appendChild(caption);
      scaleRow.appendChild(option);
    });

    questionBox.appendChild(scaleRow);
    wrapper.appendChild(questionBox);
  });

  return wrapper;
}
