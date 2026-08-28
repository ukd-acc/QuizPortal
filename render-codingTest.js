/* ---------- CODING TEST ---------- */
function renderCodingTestSection(section) {
  const wrapper = document.createElement("div");
  wrapper.className = "coding-section";
  const sectionKey = section._sectionIndex;
  
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
        <textarea id="codeInput-${sectionKey}" class="code-editor" placeholder="Write your C# code here...">${section.startingCode || ""}</textarea>
      </div>
      <div class="code-actions">
        <button class="runCodeBtn" data-section-id="${sectionKey}">Run Code</button>
        <button class="clearCodeBtn" data-section-id="${sectionKey}">Clear</button>
      </div>
      <div class="output-panel" id="codeOutput-${sectionKey}"></div>
    </div>
  `;

  const runBtn = wrapper.querySelector(".runCodeBtn");
  const clearBtn = wrapper.querySelector(".clearCodeBtn");
  const codeInput = wrapper.querySelector(`#codeInput-${sectionKey}`);

  runBtn.addEventListener("click", async () => {
    const code = codeInput.value;
    const outputPanel = wrapper.querySelector(`#codeOutput-${sectionKey}`);
    outputPanel.innerHTML = "<p class='loading'>Compiling and running...</p>";
    
    const result = await compileAndRunCode(code, section.testCases, section);
    displayResults(result, outputPanel);
    
    // Store answer for grading
    state.answers[`coding_test-${sectionKey}`] = {
      code: code,
      passed: result.allPassed || false,
      output: result.output || ""
    };
  });

  clearBtn.addEventListener("click", () => {
    codeInput.value = section.startingCode || "";
    const outputPanel = wrapper.querySelector(`#codeOutput-${sectionKey}`);
    outputPanel.innerHTML = "";
    delete state.answers[`coding_test-${sectionKey}`];
  });

  return wrapper;
}

async function compileAndRunCode(code, testCases, section) {
  try {
    console.log("Compiling C# code with OnlineGDB");
    console.log("Code:", code.substring(0, 100) + "...");
    
    // Wrap student code to handle test execution
    const wrappedCode = wrapCodeForTesting(code, testCases);
    
    // Use OnlineGDB API - free, no key required, works from GitHub Pages
    const response = await fetch("https://api.onlinegdb.com/v1/languages/csharp/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: wrappedCode,
        stdin: "",
        commandLineArgs: ""
      })
    });

    console.log("Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Compiler error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("OnlineGDB result:", result);
    
    return parseCompilerResult(result, testCases);
    
  } catch (error) {
    console.error("Compilation error:", error);
    return {
      success: false,
      error: "Compilation failed: " + error.message,
      allPassed: false
    };
  }
}

function wrapCodeForTesting(code, testCases) {
  // Wrap the student's code to run test cases
  if (!testCases || testCases.length === 0) {
    // No test cases, just wrap in Main
    return `using System;\n\n${code}\n\nclass Program {\n  static void Main() {\n    try {\n      var solution = new Solution();\n      Console.WriteLine("Code compiled and executed successfully!");\n    } catch (Exception e) {\n      Console.WriteLine("ERROR: " + e.Message);\n    }\n  }\n}`;
  }

  // Generate test runner
  let testRunner = `using System;\n\n${code}\n\nclass Program {\n  static void Main() {\n    var solution = new Solution();\n    int passCount = 0;\n    int totalTests = ${testCases.length};\n\n`;

  testCases.forEach((testCase, idx) => {
    testRunner += `    try {\n`;
    testRunner += `      var result = solution.Execute("${testCase.input.replace(/"/g, '\\"')}");\n`;
    testRunner += `      var expected = "${testCase.expectedOutput.replace(/"/g, '\\"')}";\n`;
    testRunner += `      if (result.ToString() == expected) {\n`;
    testRunner += `        Console.WriteLine("[TEST ${idx + 1}] PASS");\n`;
    testRunner += `        passCount++;\n`;
    testRunner += `      } else {\n`;
    testRunner += `        Console.WriteLine("[TEST ${idx + 1}] FAIL - Expected: " + expected + ", Got: " + result);\n`;
    testRunner += `      }\n`;
    testRunner += `    } catch (Exception e) {\n`;
    testRunner += `      Console.WriteLine("[TEST ${idx + 1}] ERROR - " + e.Message);\n`;
    testRunner += `    }\n\n`;
  });

  testRunner += `    Console.WriteLine("\\n=== SUMMARY ===");\n`;
  testRunner += `    Console.WriteLine("Passed: " + passCount + " / " + totalTests);\n`;
  testRunner += `  }\n}`;

  return testRunner;
}

function parseCompilerResult(result, testCases) {
  // Parse OnlineGDB compiler response
  console.log("Full compiler response:", JSON.stringify(result, null, 2));
  
  // Check for compilation errors
  if (result.compileError && result.compileError.trim()) {
    return {
      success: false,
      compilation: {
        errors: result.compileError
      },
      allPassed: false
    };
  }

  // Check for runtime errors
  if (result.runTimeError && result.runTimeError.trim()) {
    return {
      success: false,
      error: result.runTimeError,
      allPassed: false
    };
  }

  // Check for output
  let output = result.output || "";
  
  // OnlineGDB may also return error in this field
  if (result.error && result.error.trim()) {
    output = result.error;
  }

  console.log("Extracted output:", output);
  const testResults = parseTestOutput(output, testCases);

  return {
    success: true,
    output: output,
    testResults: testResults,
    allPassed: testResults.every(t => t.Passed),
    compilation: null
  };
}

function parseNetFiddleResult(result, testCases) {
  // Deprecated - kept for compatibility
  return parseCompilerResult(result, testCases);
}

function parseRextesterResult(result, testCases) {
  // Deprecated - kept for compatibility
  return parseCompilerResult(result, testCases);
}

function parseTestOutput(output, testCases) {
  // Parse the test output from our wrapped code
  const lines = output.split("\n");
  const testResults = [];

  testCases.forEach((testCase, idx) => {
    const testLabel = `[TEST ${idx + 1}]`;
    const testLine = lines.find(line => line.includes(testLabel));

    if (!testLine) {
      testResults.push({
        Input: testCase.input,
        Expected: testCase.expectedOutput,
        Actual: "No output",
        Passed: false
      });
      return;
    }

    const passed = testLine.includes("PASS");
    testResults.push({
      Input: testCase.input,
      Expected: testCase.expectedOutput,
      Actual: testLine,
      Passed: passed
    });
  });

  return testResults;
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

  if (result.testResults && result.testResults.length > 0) {
    html += `<div class="test-results"><strong>Test Results:</strong>`;
    result.testResults.forEach((test, idx) => {
      const passClass = test.Passed || test.passed ? "pass" : "fail";
      html += `
        <div class="test-case ${passClass}">
          <span class="test-num">Test ${idx + 1}:</span>
          <span class="test-status">${(test.Passed || test.passed) ? "✓ PASS" : "✗ FAIL"}</span>
          ${!(test.Passed || test.passed) ? `<div class="test-details">Expected: ${test.Expected || test.expected}<br>Got: ${test.Actual || test.actual}</div>` : ""}
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
