/* ---------- CODE BLOCKS FILL IN THE BLANK SECTION ---------- */
function renderCodeBlocksFITBSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "section code-blocks-fitb";
  wrapper.innerHTML = `<h2>${section.title}</h2><p>${section.instructions}</p>`;

  section.questions.forEach((q, idx) => {
    const questionBox = document.createElement("div");
    questionBox.className = "question-box";

    const row = document.createElement("div");
    row.className = "cbfitb-row";

    // Display question prompt (if any)
    if (q.prompt) {
      const prompt = document.createElement("p");
      prompt.className = "cbfitb-prompt";
      prompt.textContent = q.prompt;
      row.appendChild(prompt);
    }

    // Check if blank is in code
    const hasBlankInCode = q.code && q.code.includes("__");

    // Display code block
    if (q.code) {
      const codeBlock = document.createElement("pre");
      codeBlock.className = "cbfitb-code-block";
      const codeEl = document.createElement("code");
      
      if (hasBlankInCode) {
        // Replace __ with appropriately sized input field
        const codeParts = q.code.split("__");
        let html = escapeHtml(codeParts[0]);
        
        for (let i = 1; i < codeParts.length; i++) {
          // Dynamically size based on the longest expected answer
          let maxAnswerLength = 5; // default minimum
          
          if (Array.isArray(q.answer)) {
            maxAnswerLength = Math.max(...q.answer.map(a => a.length));
          } else if (q.answer) {
            maxAnswerLength = q.answer.length;
          }
          
          // Calculate width: each character is roughly 0.65em in monospace font
          // Add padding for visual breathing room
          const widthPx = Math.max(maxAnswerLength * 8.5 + 20, 50);
          
          html += `<input type="text" class="cbfitb-input cbfitb-input-inline" data-section="${section._sectionIndex}" data-question="${idx}" data-blank="${i - 1}" style="width: ${widthPx}px;" placeholder=""/>`;
          html += escapeHtml(codeParts[i]);
        }
        
        codeEl.innerHTML = html;
      } else {
        // Just display code as-is (no blanks in code)
        codeEl.textContent = q.code;
      }
      
      codeBlock.appendChild(codeEl);
      row.appendChild(codeBlock);
    }

    // Display blank input AFTER code only if:
    // 1. There's no blank in the code, AND
    // 2. Either there's no code at all, OR there IS code but no blank in it
    if (!hasBlankInCode) {
      const inputContainer = document.createElement("div");
      inputContainer.className = "cbfitb-answer-container";
      
      const answerInput = document.createElement("input");
      answerInput.type = "text";
      answerInput.className = "cbfitb-input cbfitb-input-after";
      answerInput.dataset.section = section._sectionIndex;
      answerInput.dataset.question = idx;
      answerInput.placeholder = "Enter answer";
      
      inputContainer.appendChild(answerInput);
      row.appendChild(inputContainer);
    }

    questionBox.appendChild(row);
    wrapper.appendChild(questionBox);
  });

  return wrapper;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
