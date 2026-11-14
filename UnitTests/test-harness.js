const quizPortalTests = [];

function test(name, callback) {
  quizPortalTests.push({ name, callback });
}

function assert(condition, message = "Assertion failed") {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message = "Values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function resetTestState(sections = [], answers = {}) {
  document.querySelector("#test-fixtures").replaceChildren();
  document.querySelector("#app").replaceChildren();
  state.quiz = { title: "Unit Test", sections };
  state.answers = answers;
  state.submitted = false;
  state.startTime = new Date();
  state.endTime = null;
  state.deadline = null;
  state.user = null;
  state.settings = {};
  state.timerWarnings = new Set();
  state.timerInterval = null;
  state.timerWarningTimeout = null;
  state.timerWarningFlashTimeout = null;
  state.timerWarningAutoHideCancelled = false;
}

function addTestInput(className, sectionIndex, questionIndex, value = "", extraAttributes = {}) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = className;
  input.dataset.section = sectionIndex;
  input.dataset.question = questionIndex;
  input.value = value;
  for (const [name, attributeValue] of Object.entries(extraAttributes)) {
    input.dataset[name] = attributeValue;
  }
  document.querySelector("#test-fixtures").appendChild(input);
  return input;
}

const TEST_TIMEOUT_MS = 15000;

// A stalled promise is the failure this suite exists to catch, so it must fail rather than hang the run.
function withTestTimeout(result, name) {
  let timeoutId;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${name} did not finish within ${TEST_TIMEOUT_MS / 1000} seconds`)), TEST_TIMEOUT_MS);
  });
  return Promise.race([result, timeout]).finally(() => clearTimeout(timeoutId));
}

async function runQuizPortalTests() {
  const results = document.querySelector("#test-results");
  const summary = document.querySelector("#test-summary");
  let passed = 0;
  const failures = [];

  for (const { name, callback } of quizPortalTests) {
    const item = document.createElement("li");
    try {
      await withTestTimeout(callback(), name);
      item.className = "pass";
      item.textContent = `PASS ${name}`;
      passed++;
    } catch (error) {
      item.className = "fail";
      item.textContent = `FAIL ${name}: ${error.stack || error.message || error}`;
      failures.push({ name, error });
    }
    results.appendChild(item);
  }

  summary.className = failures.length ? "fail" : "pass";
  summary.textContent = `${passed}/${quizPortalTests.length} tests passed`;
  window.quizPortalTestResults = { passed, failed: failures.length, failures };
}

window.addEventListener("DOMContentLoaded", runQuizPortalTests);