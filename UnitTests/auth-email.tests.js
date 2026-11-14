test("auth selects the newest matching course term", async () => {
  const previousCourseConfig = COURSE_CONFIG;
  const previousLoadJSON = loadJSON;
  COURSE_CONFIG = { MockCourse: { termFolders: ["Fall2025", "Fall2026"] } };
  const fixtures = {
    "MockCourse/Fall2025/users.json": [{ username: "tester", password: "pass", fullName: "Test User" }],
    "MockCourse/Fall2026/users.json": [{ username: "tester", password: "pass", fullName: "Test User" }],
    "MockCourse/Fall2025/settings.json": { startDate: "2025-08-01" },
    "MockCourse/Fall2026/settings.json": { startDate: "2026-08-01" }
  };
  loadJSON = async path => fixtures[path] || null;

  try {
    const matches = await findCourseMatches("tester", "pass");
    assertEqual(matches.length, 1, "course match count");
    assertEqual(matches[0].termFolder, "Fall2026", "selected term");
  } finally {
    COURSE_CONFIG = previousCourseConfig;
    loadJSON = previousLoadJSON;
  }
});

test("email results include score, duration, and escaped-independent answer text", async () => {
  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  const sent = [];
  globalThis.emailjs = {
    init() {},
    send: (...args) => { sent.push(args); return Promise.resolve(); }
  };
  globalThis.alert = () => {};
  state.user = { username: "tester", fullName: "Test User" };
  state.settings = {
    emailConfig: { serviceID: "service", templateID: "template", publicKey: "public" },
    emailRecipients: ["instructor@example.test"]
  };
  state.startTime = new Date("2026-11-06T10:00:00Z");
  state.endTime = new Date("2026-11-06T10:30:00Z");
  state.courseTitle = "Mock Course";
  state.selectedCourse = "MockCourse";
  state.selectedQuizFolder = "Midterm";
  state.quiz = { title: "Midterm", sections: [{ type: "multiple_choice" }] };

  try {
    const outcome = await sendResultsByEmail({
      points: 2, total: 3, percent: 67,
      wrongAnswers: [{ type: "MC", question: "Q", student: "odd <answer>", correct: "A" }],
      shortAnswerResponses: [],
      likertResponses: []
    });
    assertEqual(outcome.sent, true, "email send outcome");
    assertEqual(sent.length, 1, "email send calls");
    assert(sent[0][2].message.includes("Score: 2/3 (67%)"), "score omitted from email");
    assert(sent[0][2].message.includes("Duration: 30 minutes"), "duration omitted from email");
    assert(sent[0][2].message.includes("odd <answer>"), "student answer omitted from email");
  } finally {
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
  }
});

test("short-answer-only email omits reference answers", async () => {
  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  let params;
  globalThis.emailjs = {
    send: (_service, _template, value) => { params = value; return Promise.resolve(); }
  };
  globalThis.alert = () => {};
  state.user = { username: "tester", fullName: "Test User" };
  state.settings = { emailConfig: { serviceID: "s", templateID: "t" }, emailRecipients: ["teacher"] };
  state.quiz = { title: "Open Book", sections: [{ type: "short_answer" }] };

  try {
    const outcome = await sendResultsByEmail({
      points: 0, total: 0, percent: 0, wrongAnswers: [],
      shortAnswerResponses: [{ question: "Explain", answer: "My response", correctAnswer: "Private reference" }],
      likertResponses: []
    });
    assertEqual(outcome.sent, true, "email send outcome");
    assert(params.message.includes("My response"), "student response omitted");
    assert(!params.message.includes("Private reference"), "reference answer leaked into email");
  } finally {
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
  }
});

test("loadJSON aborts a request that does not respond", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleWarn = console.warn;
  let signal;
  globalThis.fetch = (_path, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  };
  console.warn = () => {};

  try {
    const value = await loadJSON("slow-test.json", 10);
    assertEqual(value, null, "timed-out JSON result");
    assert(signal.aborted, "stalled request was not aborted");
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalConsoleWarn;
  }
});

test("code execution aborts a compiler request that does not respond", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  let signal;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  };
  console.error = () => {};

  try {
    const result = await compileAndRunCode("class Solution {}", [], {}, 10);
    assertEqual(result.success, false, "timed-out compile success");
    assertEqual(result.allPassed, false, "timed-out compile pass state");
    assert(result.error.includes("timed out"), "timeout was not identified in the result");
    assert(signal.aborted, "compiler request was not aborted");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

// Goes through onLogin because the timer test assigns state.user directly and so
// cannot see a login that drops the roster's accommodation.
test("logging in keeps the roster accommodation used by the exam timer", async () => {
  resetTestState();
  document.querySelector("#app").innerHTML =
    '<input id="username" value="tester"/><input id="password" value="pass"/><button id="loginBtn"></button>';
  const previousCourseConfig = COURSE_CONFIG;
  const previousLoadJSON = loadJSON;
  COURSE_CONFIG = { MockCourse: { label: "Mock Course", termFolders: ["Fall2026"] } };
  const fixtures = {
    "MockCourse/Fall2026/users.json": [{ username: "tester", password: "pass", fullName: "Test User", accommodation: "timeAndHalf" }],
    "MockCourse/Fall2026/settings.json": { startDate: "2026-08-01", activeQuizzes: [] }
  };
  loadJSON = async path => fixtures[path] || null;

  try {
    await onLogin();
    assertEqual(state.user?.accommodation, "timeAndHalf", "accommodation after login");
  } finally {
    COURSE_CONFIG = previousCourseConfig;
    loadJSON = previousLoadJSON;
  }
});

test("choosing a course uses that course's roster accommodation", async () => {
  resetTestState();
  document.querySelector("#app").innerHTML =
    '<input id="username" value="tester"/><input id="password" value="pass"/><button id="loginBtn"></button>';
  const previousCourseConfig = COURSE_CONFIG;
  const previousLoadJSON = loadJSON;
  COURSE_CONFIG = {
    CourseA: { label: "Course A", termFolders: ["Fall2026"] },
    CourseB: { label: "Course B", termFolders: ["Fall2026"] }
  };
  const fixtures = {
    "CourseA/Fall2026/users.json": [{ username: "tester", password: "pass", fullName: "Test User" }],
    "CourseB/Fall2026/users.json": [{ username: "tester", password: "pass", fullName: "Test User", accommodation: "doubleTime" }],
    "CourseA/Fall2026/settings.json": { activeQuizzes: [] },
    "CourseB/Fall2026/settings.json": { activeQuizzes: [] }
  };
  loadJSON = async path => fixtures[path] || null;

  try {
    await onLogin();
    document.querySelectorAll(".course-option")[1].click();
    assertEqual(state.selectedCourse, "CourseB", "selected course");
    assertEqual(state.user.accommodation, "doubleTime", "accommodation for the chosen course");
    assertEqual(state.user.password, undefined, "password kept in state");
  } finally {
    COURSE_CONFIG = previousCourseConfig;
    loadJSON = previousLoadJSON;
  }
});
