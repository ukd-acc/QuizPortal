test("timed quizzes use the configured duration and accommodation multiplier", () => {
  const timer = document.createElement("div");
  timer.id = "timer";
  const toggle = document.createElement("button");
  toggle.id = "toggleTimerBtn";
  document.querySelector("#app").replaceChildren(timer, toggle);

  for (const [accommodation, expectedMinutes] of [["standard", 60], ["timeandhalf", 90], ["doubletime", 120]]) {
    state.settings = { timed: true, durationMinutes: 60 };
    state.user = { accommodation };
    state.startTime = new Date();
    state.submitted = false;
    state.timerWarnings = new Set();
    try {
      startTimer();
      assertEqual((state.deadline - state.startTime) / 60000, expectedMinutes, `${accommodation} deadline`);
    } finally {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }
});

test("expired deadline autosubmits once and leaves no running interval", () => {
  resetTestState();
  const app = document.querySelector("#app");
  app.innerHTML = '<div id="timer"></div><button id="toggleTimerBtn"></button><button id="submitBtn"></button>';
  const originalAlert = globalThis.alert;
  const originalSend = globalThis.sendResultsByEmail;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.alert = () => {};
  globalThis.sendResultsByEmail = () => {};
  globalThis.requestAnimationFrame = () => 0;
  const timer = document.querySelector("#timer");
  state.settings = { timed: true, durationMinutes: 60 };
  state.startTime = new Date(Date.now() - 60 * 60 * 1000 - 1000);

  try {
    startTimer();
    assert(state.submitted, "expired quiz was not submitted");
    assert(app.innerHTML.includes("Quiz Summary"), "summary was not rendered");
    assertEqual(timer.textContent, "00:00");
    assertEqual(state.timerInterval, null, "timer interval remains active after immediate timeout");
  } finally {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.alert = originalAlert;
    globalThis.sendResultsByEmail = originalSend;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test("grading errors leave answers available and re-enable submit", () => {
  resetTestState([{ type: "true_false", questions: null, _sectionIndex: 0 }]);
  const app = document.querySelector("#app");
  app.innerHTML = '<button id="submitBtn" disabled></button>';
  const originalAlert = globalThis.alert;
  const originalConsoleError = console.error;
  let alertMessage = "";
  globalThis.alert = message => { alertMessage = message; };
  console.error = () => {};

  try {
    onSubmit(false);
    assert(!state.submitted, "failed grading marked the quiz submitted");
    assert(!document.querySelector("#submitBtn").disabled, "submit button stayed disabled");
    assert(alertMessage.includes("could not be graded"), "student-facing error was not shown");
  } finally {
    globalThis.alert = originalAlert;
    console.error = originalConsoleError;
  }
});

test("un-timed quiz does not create an exam deadline", () => {
  resetTestState();
  const timer = document.createElement("div");
  timer.id = "timer";
  document.querySelector("#app").replaceChildren(timer);
  state.settings = { timed: false, durationMinutes: 60 };
  state.startTime = new Date();
  startTimer();
  assertEqual(state.deadline, null);
  assert(/^\d{2}:\d{2}$/.test(timer.textContent), "elapsed timer is not formatted");
  clearInterval(state.timerInterval);
  state.timerInterval = null;
});

test("a stalled email shows results immediately and then tells the student", async () => {
  resetTestState([]);
  const app = document.querySelector("#app");
  const originalEmailJS = globalThis.emailjs;
  const originalAlert = globalThis.alert;
  const originalSend = globalThis.sendResultsByEmail;
  const originalConsoleError = console.error;
  const alerts = [];
  let pendingEmail;
  globalThis.emailjs = { send: () => new Promise(() => {}) };
  globalThis.alert = message => alerts.push(message);
  globalThis.sendResultsByEmail = result => (pendingEmail = originalSend(result, 10));
  console.error = () => {};
  state.user = { username: "tester", fullName: "Test User" };
  state.settings = {
    emailConfig: { serviceID: "service", templateID: "template" },
    emailRecipients: ["instructor@example.test"]
  };
  state.courseTitle = "Test Course";
  state.selectedCourse = "TestCourse";
  state.selectedQuizFolder = "TestQuiz";
  state.quiz = { title: "Test Quiz", sections: [] };

  try {
    onSubmit(false);
    assert(state.submitted, "submission did not complete");
    assert(app.innerHTML.includes("Quiz Summary"), "summary waited for the unresolved email request");
    assertEqual(alerts, [], "alerts before the email timed out");

    const outcome = await pendingEmail;
    assertEqual(outcome.sent, false, "stalled email outcome");
    assert(alerts.some(message => message.includes("notify your instructor")), "student was not told about the stalled email");
  } finally {
    globalThis.emailjs = originalEmailJS;
    globalThis.alert = originalAlert;
    globalThis.sendResultsByEmail = originalSend;
    console.error = originalConsoleError;
  }
});

test("submission renders a very long unusual answer without treating it as markup", () => {
  resetTestState([{
    type: "fill_in_the_blank",
    questions: [{ prompt: "___", answers: [["accepted"]] }],
    _sectionIndex: 0
  }]);
  const app = document.querySelector("#app");
  app.innerHTML = '<button id="submitBtn"></button>';
  const originalAlert = globalThis.alert;
  globalThis.alert = () => {};
  const longAnswer = "<script>" + "x".repeat(200000) + "</script>";
  addTestInput("fib-input", 0, 0, longAnswer);

  try {
    onSubmit(false);
    assert(state.submitted, "submission did not complete");
    assert(app.innerHTML.includes("Quiz Summary"), "summary was not rendered");
    assert(!app.innerHTML.includes("<script>"), "student input was inserted as markup");
    assert(app.innerHTML.includes("&lt;script&gt;"), "escaped student text was not retained");
  } finally {
    globalThis.alert = originalAlert;
  }
});

test("a grading failure at the deadline stops the timer and leaves submit available", () => {
  resetTestState([{ type: "true_false", questions: null, _sectionIndex: 0 }]);
  document.querySelector("#app").innerHTML = '<button id="submitBtn" disabled></button>';
  const originalAlert = globalThis.alert;
  const originalConsoleError = console.error;
  globalThis.alert = () => {};
  console.error = () => {};
  state.timerInterval = setInterval(() => {}, 100000);

  try {
    onSubmit(true);
    assertEqual(state.timerInterval, null, "timer interval after failed autosubmit");
    assert(!state.submitted, "failed grading marked the quiz submitted");
    assert(!document.querySelector("#submitBtn").disabled, "submit button stayed disabled");
  } finally {
    globalThis.alert = originalAlert;
    console.error = originalConsoleError;
  }
});

// Reproduces the reported freeze one step later than the grading test above:
// grading has succeeded, so the attempt must still reach the instructor.
test("a summary failure does not freeze the exam or lose the graded attempt", () => {
  resetTestState([]);
  document.querySelector("#app").innerHTML = '<button id="submitBtn"></button>';
  const originalSummary = globalThis.showSummary;
  const originalSend = globalThis.sendResultsByEmail;
  const originalAlert = globalThis.alert;
  const originalConsoleError = console.error;
  const alerts = [];
  let emailAttempts = 0;
  globalThis.showSummary = () => { throw new Error("summary failed"); };
  globalThis.sendResultsByEmail = () => { emailAttempts++; };
  globalThis.alert = message => alerts.push(message);
  console.error = () => {};

  try {
    try { onSubmit(false); } catch { /* the assertions below describe the student-visible outcome */ }
    assertEqual(emailAttempts, 1, "email attempts after a summary failure");
    assert(alerts.length > 0, "student saw no message after the summary failed");
  } finally {
    globalThis.showSummary = originalSummary;
    globalThis.sendResultsByEmail = originalSend;
    globalThis.alert = originalAlert;
    console.error = originalConsoleError;
  }
});

test("an email failure before the request starts is reported to the student", () => {
  resetTestState([]);
  document.querySelector("#app").innerHTML = '<button id="submitBtn"></button>';
  const originalEmailJS = globalThis.emailjs;
  const originalAlert = globalThis.alert;
  const originalConsoleError = console.error;
  const alerts = [];
  globalThis.emailjs = { send: () => { throw new Error("SDK failed"); } };
  globalThis.alert = message => alerts.push(message);
  console.error = () => {};
  state.user = { username: "tester", fullName: "Test User" };
  state.settings = {
    emailConfig: { serviceID: "service", templateID: "template" },
    emailRecipients: ["instructor@example.test"]
  };

  try {
    try { onSubmit(false); } catch { /* the assertion below describes the student-visible outcome */ }
    assert(alerts.some(message => /email/i.test(message)), "student was not told the results were not emailed");
  } finally {
    globalThis.emailjs = originalEmailJS;
    globalThis.alert = originalAlert;
    console.error = originalConsoleError;
  }
});

/* ---------- Submit flow: summary for both manual submit and time running out ---------- */

function submitWithStubbedEmail(timedOut, sections = [{ type: "true_false", points_per_question: 1, questions: [{ question: "Sky is blue?", answer: true }], _sectionIndex: 0 }]) {
  resetTestState(sections, { "tf-0-0": false });
  const app = document.querySelector("#app");
  app.innerHTML = '<button id="submitBtn"></button>';
  const originalSend = globalThis.sendResultsByEmail;
  const originalAlert = globalThis.alert;
  const alerts = [];
  let sends = 0;
  globalThis.sendResultsByEmail = () => { sends++; return Promise.resolve({ sent: true }); };
  globalThis.alert = message => alerts.push(message);
  try {
    onSubmit(timedOut);
  } finally {
    globalThis.sendResultsByEmail = originalSend;
    globalThis.alert = originalAlert;
  }
  return { app, alerts, sends };
}

test("manual submit shows the summary of incorrect answers with no time's-up notice", () => {
  const { app, alerts, sends } = submitWithStubbedEmail(false);
  assert(state.submitted, "quiz was not submitted");
  assertEqual(sends, 1, "email sends");
  assert(app.textContent.includes("Incorrect Answers"), "incorrect-answer summary missing");
  assert(app.textContent.includes("Sky is blue?"), "the missed question is not listed");
  assert(!app.querySelector(".time-up-overlay"), "time's-up notice shown for a manual submit");
  assert(!app.querySelector(".time-up-banner"), "time's-up banner shown for a manual submit");
  assertEqual(alerts, [], "popups during a normal submit");
});

test("time running out shows a large time's-up notice over the same summary", () => {
  const { app, alerts, sends } = submitWithStubbedEmail(true);
  try {
    assert(state.submitted, "quiz was not submitted");
    assertEqual(sends, 1, "email sends");
    assert(app.textContent.includes("Incorrect Answers"), "summary was not shown behind the notice");
    assert(app.textContent.includes("Sky is blue?"), "the missed question is not listed");

    const overlay = app.querySelector(".time-up-overlay");
    assert(overlay, "time's-up notice was not shown");
    assertEqual(overlay.getAttribute("role"), "alertdialog", "notice role");
    assert(overlay.textContent.includes("Time's up!"), "notice headline");
    assertEqual(document.activeElement, overlay.querySelector(".time-up-dismiss"), "focus on the dismiss button");
    assert(app.querySelector(".time-up-banner").textContent.includes("Time ran out"), "summary banner");
    assertEqual(alerts, [], "time's-up uses the on-page notice, not a popup");

    overlay.querySelector(".time-up-dismiss").click();
    assert(!app.querySelector(".time-up-overlay"), "notice did not close");
    assertEqual(document.activeElement, app.querySelector(".time-up-banner"), "focus moves to the summary banner");
    assert(app.querySelector(".time-up-banner"), "banner stays after the notice closes");
  } finally {
    app.querySelector(".time-up-overlay")?.querySelector(".time-up-dismiss").click();
  }
});

test("the time's-up notice closes with Escape", () => {
  const { app } = submitWithStubbedEmail(true);
  assert(app.querySelector(".time-up-overlay"), "notice was not shown");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  assert(!app.querySelector(".time-up-overlay"), "Escape did not close the notice");
});

test("a submit after the deadline counts as timed out even when clicked", () => {
  resetTestState([], {});
  const app = document.querySelector("#app");
  app.innerHTML = '<button id="submitBtn"></button>';
  state.deadline = new Date(Date.now() - 1000);
  const originalSend = globalThis.sendResultsByEmail;
  globalThis.sendResultsByEmail = () => Promise.resolve({ sent: true });
  try {
    onSubmit(false);
    assert(state.timedOut, "late submit was not marked timed out");
    assert(app.querySelector(".time-up-banner"), "late submit did not say time ran out");
  } finally {
    app.querySelector(".time-up-dismiss")?.click();
    globalThis.sendResultsByEmail = originalSend;
  }
});

test("email outcome is shown on the summary: success quietly, failure with a popup", async () => {
  const originalEmailJS = globalThis.emailjs;
  const originalAlert = globalThis.alert;
  const originalConsoleError = console.error;
  const alerts = [];
  globalThis.alert = message => alerts.push(message);
  console.error = () => {};

  const configure = send => {
    resetTestState([]);
    document.querySelector("#app").innerHTML = '<button id="submitBtn"></button>';
    globalThis.emailjs = { send };
    state.user = { username: "tester", fullName: "Test User" };
    state.settings = { emailConfig: { serviceID: "s", templateID: "t" }, emailRecipients: ["teacher@example.test"] };
  };

  try {
    configure(() => Promise.resolve({ status: 200 }));
    onSubmit(false);
    let status = document.querySelector("#emailStatus");
    assertEqual(status.dataset.outcome, "sending", "status while sending");
    await new Promise(resolve => setTimeout(resolve, 0));
    assertEqual(status.dataset.outcome, "sent", "status after success");
    assert(status.textContent.includes("emailed successfully"), "success text");
    assertEqual(alerts, [], "popups after success");

    configure(() => Promise.reject(new Error("offline")));
    onSubmit(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    status = document.querySelector("#emailStatus");
    assertEqual(status.dataset.outcome, "failed", "status after failure");
    assert(status.textContent.includes("notify your instructor"), "failure text");
    assertEqual(alerts.length, 1, "failure popup");
  } finally {
    globalThis.emailjs = originalEmailJS;
    globalThis.alert = originalAlert;
    console.error = originalConsoleError;
  }
});

test("email with no setup reports a clear failure without throwing", async () => {
  const originalAlert = globalThis.alert;
  const originalConsoleError = console.error;
  const alerts = [];
  globalThis.alert = message => alerts.push(message);
  console.error = () => {};
  resetTestState([]);
  try {
    const outcome = await sendResultsByEmail({ points: 0, total: 0, percent: 0, wrongAnswers: [], shortAnswerResponses: [], likertResponses: [] });
    assertEqual(outcome.sent, false, "outcome without a signed-in user");
    assert(alerts[0].includes("no user is signed in"), `unexpected message: ${alerts[0]}`);
    assertEqual(state.emailOutcome, "failed", "recorded outcome");
  } finally {
    globalThis.alert = originalAlert;
    console.error = originalConsoleError;
  }
});
