/* ---------- CODING TEST ---------- */
function renderCodingTestSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "coding-section";
  
  wrapper.innerHTML = `
    <h2>${section.title}</h2>
    <p>${section.instructions}</p>
    <div class="code-challenge">
      <div class="problem-description">
        <h3>Problem:</h3>
        <p>${section.problem}</p>
        ${section.examples ? `<h4>Examples:</h4><pre>${section.examples}</pre>` : ""}
      </div>
      <div class="code-editor-container">
        <label>Write your C# code:</label>
        <textarea id="codeInput-${section.id || 0}" class="code-editor" placeholder="Write your C# code here...">${section.startingCode || ""}</textarea>
      </div>
      <div class="code-actions">
        <button class="runCodeBtn" data-section-id="${section.id || 0}">Run Code</button>
        <button class="clearCodeBtn" data-section-id="${section.id || 0}">Clear</button>
      </div>
      <div class="output-panel" id="codeOutput-${section.id || 0}"></div>
    </div>
  `;

  const runBtn = wrapper.querySelector(".runCodeBtn");
  const clearBtn = wrapper.querySelector(".clearCodeBtn");
  const codeInput = wrapper.querySelector(`#codeInput-${section.id || 0}`);

  runBtn.addEventListener("click", async () => {
    const code = codeInput.value;
    const outputPanel = wrapper.querySelector(`#codeOutput-${section.id || 0}`);
    outputPanel.innerHTML = "<p class='loading'>Compiling and running...</p>";
    
    const result = await compileAndRunCode(code, section.testCases, section);
    displayResults(result, outputPanel);
    
    // Store answer for grading
    state.answers[`coding_test-${section.id || 0}`] = {
      code: code,
      passed: result.allPassed || false,
      output: result.output || ""
    };
  });

  clearBtn.addEventListener("click", () => {
    codeInput.value = section.startingCode || "";
    const outputPanel = wrapper.querySelector(`#codeOutput-${section.id || 0}`);
    outputPanel.innerHTML = "";
    delete state.answers[`coding_test-${section.id || 0}`];
  });

  return wrapper;
}

async function compileAndRunCode(code, testCases, section) {
  try {
    // Call your backend API
    const response = await fetch("/api/compile-csharp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        testCases: testCases,
        sectionId: section.id,
        sectionTitle: section.title
      })
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Server error: ${response.status}`,
        allPassed: false
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Compilation error:", error);
    return {
      success: false,
      error: error.message,
      allPassed: false
    };
  }
}

function displayResults(result, outputPanel) {
  let html = "";

  if (result.error) {
    html += `<div class="error"><strong>Error:</strong> ${result.error}</div>`;
  }

  if (result.compilation && result.compilation.errors) {
    html += `<div class="error"><strong>Compilation Errors:</strong><pre>${result.compilation.errors}</pre></div>`;
  }

  if (result.output) {
    html += `<div class="output"><strong>Output:</strong><pre>${result.output}</pre></div>`;
  }

  if (result.testResults) {
    html += `<div class="test-results"><strong>Test Results:</strong>`;
    result.testResults.forEach((test, idx) => {
      const passClass = test.passed ? "pass" : "fail";
      html += `
        <div class="test-case ${passClass}">
          <span class="test-num">Test ${idx + 1}:</span>
          <span class="test-status">${test.passed ? "✓ PASS" : "✗ FAIL"}</span>
          ${!test.passed ? `<div class="test-details">Expected: ${test.expected}<br>Got: ${test.actual}</div>` : ""}
        </div>
      `;
    });
    html += `</div>`;
  }

  if (result.allPassed) {
    html += `<div class="success"><strong>✓ All tests passed!</strong></div>`;
  }

  outputPanel.innerHTML = html;
}
