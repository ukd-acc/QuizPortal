// backend-compile.js
// Node.js backend for compiling and running C# code
// Install dependencies: npm install express cors body-parser axios dotenv

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Using Judge0 API (free tier available)
// Get your API key from https://judge0.com/
const JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "your-api-key-here";

// C# language ID in Judge0
const CSHARP_LANGUAGE_ID = 51;

app.post("/api/compile-csharp", async (req, res) => {
  try {
    const { code, testCases, sectionId, sectionTitle } = req.body;

    if (!code || !testCases || testCases.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Code and test cases are required",
        allPassed: false
      });
    }

    // Run each test case
    const testResults = [];
    let allPassed = true;
    let compilationErrors = null;

    for (const testCase of testCases) {
      try {
        // Prepare the input for the test
        const fullCode = `
${code}

// Auto-generated test runner
class Program {
  static void Main() {
    try {
      var result = new Solution().Execute(${testCase.input});
      System.Console.WriteLine(result);
    } catch (Exception e) {
      System.Console.WriteLine("ERROR: " + e.Message);
    }
  }
}
`;

        // Call Judge0 API to compile and run
        const response = await axios.post(
          `${JUDGE0_API_URL}/submissions?wait=true`,
          {
            language_id: CSHARP_LANGUAGE_ID,
            source_code: fullCode,
            stdin: testCase.input || ""
          },
          {
            headers: {
              "X-RapidAPI-Key": JUDGE0_API_KEY,
              "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
              "Content-Type": "application/json"
            }
          }
        );

        const submission = response.data;

        if (submission.compile_output) {
          compilationErrors = submission.compile_output;
          allPassed = false;
          testResults.push({
            input: testCase.input,
            expected: testCase.expectedOutput,
            actual: "COMPILATION ERROR",
            passed: false
          });
        } else if (submission.runtime_error) {
          compilationErrors = submission.runtime_error;
          allPassed = false;
          testResults.push({
            input: testCase.input,
            expected: testCase.expectedOutput,
            actual: "RUNTIME ERROR: " + submission.runtime_error,
            passed: false
          });
        } else {
          const output = submission.stdout ? submission.stdout.trim() : "";
          const expected = String(testCase.expectedOutput).trim();
          const passed = output === expected;

          if (!passed) {
            allPassed = false;
          }

          testResults.push({
            input: testCase.input,
            expected: expected,
            actual: output,
            passed: passed
          });
        }
      } catch (error) {
        console.error("Test execution error:", error.message);
        allPassed = false;
        testResults.push({
          input: testCase.input,
          expected: testCase.expectedOutput,
          actual: "Error: " + error.message,
          passed: false
        });
      }
    }

    res.json({
      success: true,
      testResults: testResults,
      allPassed: allPassed,
      compilation: compilationErrors ? { errors: compilationErrors } : null,
      sectionId: sectionId,
      sectionTitle: sectionTitle
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      error: "Server error: " + error.message,
      allPassed: false
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "C# Code Compiler" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ C# Compiler backend running on port ${PORT}`);
  console.log(`POST /api/compile-csharp - Compile and run C# code`);
  console.log(`GET /health - Health check`);
});
