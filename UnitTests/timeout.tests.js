// End-to-end timeout tests. Each test opens the sample quiz in fixtures/TimeoutCourse
// through the real loader and renderers, answers it, and lets the real timer run out
// after a very short limit (about 1-3 seconds).

const TIMEOUT_SAMPLE_COURSE = "UnitTests/fixtures/TimeoutCourse";
const TIMEOUT_SAMPLE_TOTAL = 14; // 2 TF + 2 MC + 2 matching + 3 blanks + 2 list + 1 code MC + 2 code blank

async function waitFor(condition, timeoutMs, label) {
  const giveUpAt = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > giveUpAt) throw new Error(`timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

// Opens the sample quiz with a time limit of `seconds`. `send` may replace the
// EmailJS request; every request is recorded in run.sends either way.
async function openTimeoutSample({ seconds = 2, accommodation = "standard", send } = {}) {
  resetTestState();
  const previous = { emailjs: globalThis.emailjs, alert: globalThis.alert, loadJSON, consoleError: console.error };
  const run = { sends: [], alerts: [] };
  globalThis.emailjs = {
    init() {},
    send: (_service, _template, params) => {
      run.sends.push(params);
      return send ? send(params) : Promise.resolve({ status: 200 });
    }
  };
  globalThis.alert = message => run.alerts.push(message);
  console.error = () => {};
  run.cleanup = () => {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    document.querySelector(".time-up-dismiss")?.click();
    globalThis.emailjs = previous.emailjs;
    globalThis.alert = previous.alert;
    loadJSON = previous.loadJSON;
    console.error = previous.consoleError;
  };

  loadJSON = async (path, timeoutMs) => {
    const value = await previous.loadJSON(`/${path}`, timeoutMs);
    if (value && path.endsWith("/Sample/settings.json")) value.durationMinutes = seconds / 60;
    return value;
  };
  state.selectedCourse = TIMEOUT_SAMPLE_COURSE;
  state.selectedQuizFolder = "Sample";
  state.user = { username: "timeout-test", fullName: "Timeout Test", accommodation };

  try {
    await initQuiz();
    assert(document.querySelector("#submitBtn"), "sample quiz did not open");
  } catch (error) {
    run.cleanup();
    throw error;
  } finally {
    loadJSON = previous.loadJSON;
  }
  return run;
}

function sampleSection(type) {
  const section = state.quiz.sections.find(candidate => candidate.type === type);
  assert(section, `sample quiz has no ${type} section`);
  return document.querySelector(`#section-${section._sectionIndex}`);
}

function clickOption(rowElement, optionSelector, text) {
  const option = Array.from(rowElement.querySelectorAll(optionSelector)).find(element => element.textContent.trim() === text);
  assert(option, `no option "${text}"`);
  option.click();
}

function typeInto(element, value) {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

// Answers every question. "mixed" earns 8 of 14 points with 5 questions wrong.
function answerTimeoutSample(mode) {
  const correct = mode === "correct";
  const tfRows = sampleSection("true_false").querySelectorAll(".tf-row");
  tfRows[0].querySelectorAll(".tf-option")[0].click(); // True: correct
  tfRows[1].querySelectorAll(".tf-option")[correct ? 1 : 0].click(); // mixed picks True: wrong

  const mcRows = sampleSection("multiple_choice").querySelectorAll(".mc-row");
  clickOption(mcRows[0], ".mc-option", "new");
  clickOption(mcRows[1], ".mc-option", correct ? "bool" : "int");

  const selects = sampleSection("matching").querySelectorAll("select");
  selects[0].value = "Loop";
  selects[0].dispatchEvent(new Event("change", { bubbles: true }));
  selects[1].value = correct ? "Variable" : "";
  selects[1].dispatchEvent(new Event("change", { bubbles: true }));

  const blanks = sampleSection("fill_in_the_blank").querySelectorAll(".fib-input");
  typeInto(blanks[0], "//");
  typeInto(blanks[1], "Nintendo");
  typeInto(blanks[2], correct ? "Sega" : "nintendo"); // a repeated answer earns credit once

  const listBlanks = sampleSection("fill_in_the_blank_list").querySelectorAll(".fibl-input");
  typeInto(listBlanks[0], "+");
  typeInto(listBlanks[1], "minus");

  clickOption(sampleSection("code_blocks_mc").querySelector(".cbmc-row"), ".cbmc-option", "5");
  typeInto(sampleSection("code_blocks_fitb").querySelector(".cbfitb-input"), correct ? "2" : "3");
  typeInto(sampleSection("short_answer").querySelector(".sa-input"), "int Max(int a, int b) { return a > b ? a : b; }");
}

function assertTimedOutSummary(run, points) {
  const app = document.querySelector("#app");
  assert(state.submitted, "quiz was not submitted when time ran out");
  assert(state.timedOut, "submission was not marked as timed out");
  assertEqual(state.timerInterval, null, "timer still running after the timeout");
  assert(app.textContent.includes(`You scored ${points}/${TIMEOUT_SAMPLE_TOTAL}`), `summary did not show ${points}/${TIMEOUT_SAMPLE_TOTAL}`);
  assert(app.textContent.includes("Incorrect Answers"), "summary of incorrect answers is missing");
  assert(app.querySelector(".time-up-overlay")?.textContent.includes("Time's up!"), "time's-up notice was not shown");
  assert(app.querySelector(".time-up-banner")?.textContent.includes("Time ran out"), "summary banner is missing");
  assert(!document.querySelector("#submitBtn"), "the quiz form is still on screen");
  assertEqual(run.sends.length, 1, "emails sent");
  assert(run.sends[0].message.includes(`Score: ${points}/${TIMEOUT_SAMPLE_TOTAL}`), "email score");
}

test("timeout sample: every question type renders and an all-correct answer key scores 14/14 on Submit", async () => {
  const run = await openTimeoutSample({ seconds: 30 });
  try {
    assertEqual(state.quiz.sections.length, 8, "sample sections");
    answerTimeoutSample("correct");
    document.querySelector("#submitBtn").click();
    assert(document.querySelector("#app").textContent.includes(`You scored 14/${TIMEOUT_SAMPLE_TOTAL}`), "all-correct score");
    assert(document.querySelector("#app").textContent.includes("All answers correct"), "all-correct message");
    assert(!document.querySelector(".time-up-overlay"), "time's-up notice on a manual submit");
    assertEqual(state.timedOut, false, "manual submit marked timed out");
    assertEqual(run.sends.length, 1, "emails sent");
  } finally {
    run.cleanup();
  }
});

test("timeout sample: a 2-second limit autosubmits mixed answers and shows the notice over the summary", async () => {
  const run = await openTimeoutSample({ seconds: 2 });
  try {
    const timer = document.querySelector("#timer");
    answerTimeoutSample("mixed");
    assert(!state.submitted, "submitted before time ran out");
    assert(/^00:0[12]$/.test(timer.textContent), `timer did not start counting down: ${timer.textContent}`);
    await waitFor(() => state.submitted, 4000, "the 2-second timeout");

    assertTimedOutSummary(run, 8);
    assertEqual(state.submissionResult.wrongAnswers.length, 5, "wrong-answer records");
    const app = document.querySelector("#app");
    for (const missed of ["A method can only return a string.", "Which type holds true or false?", "Stores one value with a name", "first console wars", "What value is printed?"]) {
      assert(app.textContent.includes(missed), `summary does not list the missed question: ${missed}`);
    }
    assert(!app.textContent.includes("A C# array index starts at 0."), "a correct answer was listed as wrong");
    assert(run.sends[0].message.includes("int Max(int a, int b)"), "short answer missing from the email");
    assertEqual(timer.textContent, "00:00", "timer did not stop at 00:00");
  } finally {
    run.cleanup();
  }
});

test("timeout sample: running out of time with nothing answered scores 0 and lists every question", async () => {
  const run = await openTimeoutSample({ seconds: 1 });
  try {
    await waitFor(() => state.submitted, 3000, "the 1-second timeout");
    assertTimedOutSummary(run, 0);
    assertEqual(state.submissionResult.wrongAnswers.length, 11, "one record per scored question");
    assert(run.sends[0].message.includes("(no answer)"), "email does not mark unanswered questions");
  } finally {
    run.cleanup();
  }
});

test("timeout sample: the notice closes by itself after 5 seconds and leaves the summary", async () => {
  const run = await openTimeoutSample({ seconds: 1 });
  try {
    await waitFor(() => state.submitted, 3000, "the 1-second timeout");
    const app = document.querySelector("#app");
    assert(app.querySelector(".time-up-overlay"), "notice was not shown");
    await waitFor(() => !app.querySelector(".time-up-overlay"), 6500, "the notice to close by itself");
    assert(app.textContent.includes("Quiz Summary"), "summary is gone after the notice closed");
    assert(app.querySelector(".time-up-banner"), "banner is gone after the notice closed");
    assertEqual(document.activeElement, app.querySelector(".time-up-banner"), "focus did not move to the summary");
  } finally {
    run.cleanup();
  }
});

test("timeout sample: submitting just before the limit is a normal submit and the timer never fires again", async () => {
  const run = await openTimeoutSample({ seconds: 2 });
  try {
    answerTimeoutSample("mixed");
    await new Promise(resolve => setTimeout(resolve, 1000));
    document.querySelector("#submitBtn").click();
    assertEqual(state.timedOut, false, "an on-time submit was marked timed out");
    await new Promise(resolve => setTimeout(resolve, 2000)); // past the original deadline

    assertEqual(run.sends.length, 1, "emails sent");
    assert(!document.querySelector(".time-up-overlay"), "time's-up notice after an on-time submit");
    assert(!document.querySelector(".time-up-banner"), "time-ran-out banner after an on-time submit");
    assert(document.querySelector("#app").textContent.includes(`You scored 8/${TIMEOUT_SAMPLE_TOTAL}`), "score");
  } finally {
    run.cleanup();
  }
});

test("timeout sample: time-and-a-half turns a 2-second limit into 3 seconds", async () => {
  const run = await openTimeoutSample({ seconds: 2, accommodation: "timeAndHalf" });
  try {
    assertEqual((state.deadline - state.startTime) / 1000, 3, "deadline seconds");
    await new Promise(resolve => setTimeout(resolve, 2300));
    assert(!state.submitted, "submitted at the standard limit instead of the extended one");
    await waitFor(() => state.submitted, 2500, "the extended timeout");
    assert(state.timedOut, "extended timeout was not marked timed out");
    assertEqual(run.sends.length, 1, "emails sent");
  } finally {
    run.cleanup();
  }
});

test("timeout sample: an email failure at the timeout still shows the summary and tells the student", async () => {
  const run = await openTimeoutSample({ seconds: 1, send: () => Promise.reject({ status: 0, text: "offline" }) });
  try {
    answerTimeoutSample("mixed");
    await waitFor(() => state.submitted, 3000, "the 1-second timeout");
    await waitFor(() => state.emailOutcome === "failed", 1000, "the email failure to be reported");

    assertTimedOutSummary(run, 8);
    const status = document.querySelector("#emailStatus");
    assertEqual(status.dataset.outcome, "failed", "status outcome");
    assert(status.textContent.includes("notify your instructor"), "status text");
    assert(run.alerts.some(message => message.includes("notify your instructor")), "failure popup");
  } finally {
    run.cleanup();
  }
});

test("timeout sample: a stalled email at the timeout gives up and tells the student", async () => {
  const previousTimeout = globalThis.sendResultsByEmail;
  globalThis.sendResultsByEmail = result => previousTimeout(result, 200);
  const run = await openTimeoutSample({ seconds: 1, send: () => new Promise(() => {}) });
  try {
    await waitFor(() => state.submitted, 3000, "the 1-second timeout");
    assertEqual(state.emailOutcome, "sending", "status before the email timed out");
    await waitFor(() => state.emailOutcome === "failed", 1500, "the stalled email to time out");
    assert(document.querySelector("#emailStatus").textContent.includes("notify your instructor"), "status text");
    assert(document.querySelector(".time-up-banner"), "summary banner");
  } finally {
    run.cleanup();
    globalThis.sendResultsByEmail = previousTimeout;
  }
});

test("timeout sample: Submit clicked repeatedly at the deadline sends one attempt", async () => {
  const run = await openTimeoutSample({ seconds: 1 });
  try {
    const submit = document.querySelector("#submitBtn");
    await waitFor(() => Date.now() >= state.deadline.getTime(), 2000, "the deadline");
    submit.click();
    submit.click();
    onSubmit(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); // let the timer tick again
    assertEqual(run.sends.length, 1, "emails sent");
    assert(state.timedOut, "a click after the deadline was not treated as timed out");
    assertEqual(document.querySelectorAll(".time-up-overlay").length <= 1, true, "more than one notice");
  } finally {
    run.cleanup();
  }
});
