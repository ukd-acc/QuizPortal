// End-to-end attempts at the real Game1270 Midterm Closed Book: real quiz files, real
// renderers, real shuffling, a real click on Submit. Only the EmailJS network call is mocked.
// The exam has 100 points: 15 matching, 15 true/false, 15 fill-in, 55 list blanks.

const BLANK_ANSWERS = ["", " ", "     ", "\t", "\t \t", " ", "　", "   ", "﻿"];

const ODD_ANSWERS = [
  "<script>window.__quizPortalInjected = true</script>",
  "<img src=x onerror=\"window.__quizPortalInjected = true\">",
  "</li></ul><h1>injected</h1>",
  "\"'`;--",
  "' OR '1'='1",
  "\\",
  "\\n\\t\\\\",
  "${7*7}",
  "{{7*7}}",
  "%00%0a",
  "&amp;&lt;&#x3C;",
  ".*",
  "[a-z]+(",
  "$&",
  "___",
  "__proto__",
  "constructor",
  "toString",
  "null",
  "undefined",
  "NaN",
  "0",
  "-1",
  "1e999",
  "true",
  "👩‍💻🎮🧪",
  "‮evil‬",
  "مرحبا بالعالم",
  "日本語のこたえ",
  "Z̸̢͎a̴͈l̷g̵o̶",
  "é",
  "​",
  "\uD83D",
  "x".repeat(50000)
];

function closedBookSection(type) {
  return state.quiz.sections.find(section => section.type === type);
}

function closedBookSectionElement(section) {
  return document.querySelector(`#section-${section._sectionIndex}`);
}

function chooseMatching(questionText, value) {
  const section = closedBookSection("matching");
  const index = section.prompts.findIndex(prompt => prompt.question.includes(questionText));
  assert(index >= 0, `no matching question contains ${questionText}`);
  const select = closedBookSectionElement(section).querySelectorAll("select")[index];
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function clickTrueFalse(index, value) {
  const section = closedBookSection("true_false");
  const options = closedBookSectionElement(section).querySelectorAll(".tf-row")[index].querySelectorAll(".tf-option");
  options[value ? 0 : 1].click();
}

function blanksFor(promptText) {
  for (const [type, className] of [["fill_in_the_blank", "fib-input"], ["fill_in_the_blank_list", "fibl-input"]]) {
    const section = closedBookSection(type);
    const index = section.questions.findIndex(question => question.prompt.includes(promptText));
    if (index >= 0) {
      return Array.from(closedBookSectionElement(section)
        .querySelectorAll(`.${className}[data-question="${index}"]`));
    }
  }
  throw new Error(`no fill-in question contains ${promptText}`);
}

function typeBlanks(promptText, values) {
  const inputs = blanksFor(promptText);
  assertEqual(values.length, inputs.length, `blanks in ${promptText}`);
  values.forEach((value, index) => { inputs[index].value = value; });
}

function closedBookTextInputs() {
  return Array.from(document.querySelectorAll(".fib-input, .fibl-input"));
}

function answerTrueFalseAndMatchingCorrectly() {
  closedBookSection("true_false").questions.forEach((question, index) => clickTrueFalse(index, question.answer));
  closedBookSection("matching").prompts.forEach(prompt => chooseMatching(prompt.question, prompt.answer));
}

// Opens the exam, runs `answer`, submits, and reports what the student and instructor received.
async function attemptClosedBook(answer, { send, emailTimeoutMs } = {}) {
  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  const previousConsoleError = console.error;
  const attempt = { alerts: [], emails: [] };
  globalThis.emailjs = {
    init() {},
    send: send || ((_service, _template, params) => {
      attempt.emails.push(params);
      return Promise.resolve({ status: 200 });
    })
  };
  console.error = () => {};

  try {
    resetTestState();
    await openRenderedClosedBookMidterm(false);
    globalThis.alert = message => attempt.alerts.push(message);
    await answer();
    Object.assign(attempt, await submitRenderedAttempt(emailTimeoutMs));
    attempt.text = document.querySelector("#app").textContent;
    return attempt;
  } finally {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
    console.error = previousConsoleError;
  }
}

function assertScore(attempt, points, label = "score") {
  assertEqual(attempt.result.total, 100, `${label}: possible points`);
  assertEqual(attempt.result.points, points, label);
  assert(attempt.text.includes(`You scored ${points}/100 (${points}%).`), `${label}: summary did not show ${points}/100`);
  assertEqual(attempt.emails.length, 1, `${label}: emails sent`);
  assert(attempt.emails[0].message.includes(`Score: ${points}/100 (${points}%).`), `${label}: email did not report ${points}/100`);
}

/* ---------- All correct, all incorrect, nothing answered ---------- */

test("closed book: all correct scores 100 with nothing marked wrong", async () => {
  const attempt = await attemptClosedBook(() => answerRenderedClosedBookMidterm(true));
  assertScore(attempt, 100);
  assertEqual(attempt.result.wrongAnswers.length, 0, "wrong-answer records");
  assert(attempt.text.includes("All answers correct"), "summary did not celebrate a perfect score");
  assert(attempt.emails[0].message.includes("All answers correct"), "email did not report a perfect score");
  assert(attempt.alerts.some(message => message.includes("emailed successfully")), "student was not told the email was sent");
});

test("closed book: all incorrect scores 0 with one record per question", async () => {
  const attempt = await attemptClosedBook(() => answerRenderedClosedBookMidterm(false));
  assertScore(attempt, 0);
  assertEqual(attempt.result.wrongAnswers.length, 52, "wrong-answer records");
});

test("closed book: submitting without touching anything scores 0", async () => {
  const attempt = await attemptClosedBook(() => {});
  assertScore(attempt, 0);
  assertEqual(attempt.result.wrongAnswers.length, 52, "wrong-answer records");
  assert(attempt.emails[0].message.includes("(no answer)"), "email did not mark unanswered questions");
});

/* ---------- Blank and whitespace-only answers ---------- */

for (const blank of BLANK_ANSWERS) {
  test(`closed book: every blank holding only ${JSON.stringify(blank)} counts as unanswered`, async () => {
    const attempt = await attemptClosedBook(() => {
      closedBookTextInputs().forEach(input => { input.value = blank; });
    });
    assertScore(attempt, 0);
    assertEqual(attempt.result.wrongAnswers.length, 52, "wrong-answer records");
    const textRecords = attempt.result.wrongAnswers.filter(wrong => wrong.type.startsWith("Fill in the Blank"));
    assertEqual(textRecords.length, 22, "fill-in records");
    assert(textRecords.every(wrong => wrong.student.includes("(no answer)")), "whitespace was not reported as no answer");
  });
}

test("closed book: whitespace in one blank costs only that blank", async () => {
  const attempt = await attemptClosedBook(() => {
    answerRenderedClosedBookMidterm(true);
    typeBlanks("Atari's first hit game", ["     "]);
  });
  assertScore(attempt, 99);
  assertEqual(attempt.result.wrongAnswers.length, 1, "wrong-answer records");
});

/* ---------- Partial and section-by-section mixes ---------- */

test("closed book: each section scores independently", async () => {
  const cases = [
    ["true/false all wrong", 85, () => {
      closedBookSection("true_false").questions.forEach((question, index) => clickTrueFalse(index, !question.answer));
    }],
    ["matching all blank", 85, () => {
      closedBookSection("matching").prompts.forEach(prompt => chooseMatching(prompt.question, ""));
    }],
    ["fill-in all wrong", 85, () => {
      document.querySelectorAll(".fib-input").forEach(input => { input.value = "wrong"; });
    }],
    ["list all blank", 45, () => {
      document.querySelectorAll(".fibl-input").forEach(input => { input.value = ""; });
    }]
  ];

  for (const [label, points, spoil] of cases) {
    const attempt = await attemptClosedBook(() => {
      answerRenderedClosedBookMidterm(true);
      spoil();
    });
    assertScore(attempt, points, label);
  }
});

test("closed book: answering one true/false question changes only that question", async () => {
  const attempt = await attemptClosedBook(() => {
    const questions = closedBookSection("true_false").questions;
    clickTrueFalse(0, !questions[0].answer);
    clickTrueFalse(0, questions[0].answer);
    clickTrueFalse(1, !questions[1].answer);
  });
  assertScore(attempt, 1);
});

test("closed book: partly filled multi-blank questions earn partial credit", async () => {
  const attempt = await attemptClosedBook(() => {
    typeBlanks("Bartle's Player Types", ["killers", "ACHIEVERS", "", "   "]);
    typeBlanks("founders of the first video game company", ["ted dabney", "   "]);
  });
  assertScore(attempt, 3);
  const record = attempt.result.wrongAnswers.find(wrong => wrong.question.includes("Bartle"));
  assert(record.student.startsWith("2/4 correct"), `unexpected partial record: ${record.student}`);
});

test("closed book: order does not matter inside multi-blank questions", async () => {
  const attempt = await attemptClosedBook(() => {
    answerRenderedClosedBookMidterm(true);
    typeBlanks("first console wars", ["sega", "nintendo"]);
    typeBlanks("founders of the first video game company", ["ted dabney", "nolan bushnell"]);
    typeBlanks("three parts of the MDA framework", ["aesthetics", "mechanics", "dynamics"]);
  });
  assertScore(attempt, 100);
});

/* ---------- Duplicates, accepted variants, near misses ---------- */

test("closed book: repeating an answer earns credit once", async () => {
  const cases = [
    ["first console wars", ["nintendo", "nintendo"], 99],
    ["first console wars", ["Nintendo", "  NINTENDO "], 99],
    ["founders of the first video game company", ["nolan bushnell", "nolan bushnell"], 99],
    ["List two of the oldest games", ["senet", "SENET"], 99],
    ["Bartle's Player Types", ["killers", "killers", "killers", "killers"], 97],
    ["three parts of the MDA framework", ["mechanics", "Mechanics", " mechanics "], 98]
  ];

  for (const [prompt, values, points] of cases) {
    const attempt = await attemptClosedBook(() => {
      answerRenderedClosedBookMidterm(true);
      typeBlanks(prompt, values);
    });
    assertScore(attempt, points, `${prompt} ${JSON.stringify(values)}`);
  }
});

test("closed book: two spellings of one answer earn one point", async () => {
  const cases = [
    ["Bartle's Player Types", ["killer", "killers", "achiever", "achievers"], 98],
    ["Bartle's Player Types", ["KILLER", " killers ", "explorers", "socializer"], 99],
    ["three parts of the MDA framework", ["mechanic", "mechanics", "dynamics"], 99],
    ["List six major genres", ["sim", "simulation", "sport", "sports", "race", "racing"], 97],
    ["List six major genres", ["rpg", "role-playing", "action", "adventure", "puzzle", "horror"], 99],
    ["major 9th generation consoles", ["ps5", "playstation 5", "xbox"], 99],
    ["major 9th generation consoles", ["xbox", "xbox series x", "xbox series s"], 98],
    ["major 9th generation consoles", ["switch", "nintendo switch", "switch 2"], 98]
  ];

  for (const [prompt, values, points] of cases) {
    const attempt = await attemptClosedBook(() => {
      answerRenderedClosedBookMidterm(true);
      typeBlanks(prompt, values);
    });
    assertScore(attempt, points, `${prompt} ${JSON.stringify(values)}`);
  }
});

test("closed book: any one spelling of each answer earns full credit", async () => {
  const cases = [
    ["Bartle's Player Types", ["killer", "achievers", "EXPLORER", "socializers"]],
    ["three parts of the MDA framework", ["aesthetic", "dynamic", "mechanic"]],
    ["List six major genres", ["rpg", "sim", "sport", "race", "social deduction", "visual novel"]],
    ["major 9th generation consoles", ["ps5", "xbox series x/s", "switch2"]],
    ["major 9th generation consoles", ["steam deck", "playstation 5", "xbox"]]
  ];

  for (const [prompt, values] of cases) {
    const attempt = await attemptClosedBook(() => {
      answerRenderedClosedBookMidterm(true);
      typeBlanks(prompt, values);
    });
    assertScore(attempt, 100, `${prompt} ${JSON.stringify(values)}`);
  }
});

test("closed book: accepted spellings, symbols, case, and outer whitespace earn credit", async () => {
  const cases = [
    ["Atari's first hit game", "  PONG  "],
    ["Atari's first hit game", "\tPoNg "],
    ["Shigeru Miyamoto", "　DONKEY KONG　"],
    ["Shigeru Miyamoto", "dk"],
    ["Gary Gygax", "D&D"],
    ["Gary Gygax", "d & d"],
    ["Gary Gygax", "DUNGEONS & DRAGONS"],
    ["UX stands for", "UserExperience"],
    ["revitalized the video game industry", "NES"]
  ];

  for (const [prompt, value] of cases) {
    const attempt = await attemptClosedBook(() => {
      answerRenderedClosedBookMidterm(true);
      typeBlanks(prompt, [value]);
    });
    assertScore(attempt, 100, JSON.stringify(value));
  }
});

test("closed book: near misses earn no credit", async () => {
  const nearMisses = ["pong.", "po ng", "po​ng", "ｐｏｎｇ", "pong pong", "<b>pong</b>", "pon", "pongs", "Pong!"];

  for (const value of nearMisses) {
    const attempt = await attemptClosedBook(() => {
      answerRenderedClosedBookMidterm(true);
      typeBlanks("Atari's first hit game", [value]);
    });
    assertScore(attempt, 99, JSON.stringify(value));
  }
});

/* ---------- Hostile and unusual characters ---------- */

for (const odd of ODD_ANSWERS) {
  const label = odd.length > 40 ? `${odd.length} characters` : JSON.stringify(odd);
  test(`closed book: ${label} in every blank is graded as plain wrong text`, async () => {
    const attempt = await attemptClosedBook(() => {
      answerTrueFalseAndMatchingCorrectly();
      closedBookTextInputs().forEach(input => { input.value = odd; });
    });
    assertScore(attempt, 30);
    assertEqual(attempt.result.wrongAnswers.length, 22, "wrong-answer records");
    assert(attempt.emails[0].message.includes(odd.trim().toLowerCase()), "email lost the student's text");
  });
}

test("closed book: markup in an answer is shown as text and never runs", async () => {
  window.__quizPortalInjected = false;
  const markup = ODD_ANSWERS.slice(0, 3);
  const attempt = await attemptClosedBook(() => {
    typeBlanks("three parts of the MDA framework", markup);
  });
  await new Promise(resolve => setTimeout(resolve, 50));

  const app = document.querySelector("#app");
  assertEqual(window.__quizPortalInjected, false, "student markup executed");
  assertEqual(app.querySelectorAll("script, img, h1").length, 0, "student markup became elements");
  markup.forEach(value => assert(attempt.text.includes(value.toLowerCase()), `summary lost ${value}`));
  delete window.__quizPortalInjected;
});

/* ---------- Seeded random mixes of everything above ---------- */

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Applies a random answer to every control and independently counts what it should score.
function answerRandomly(random) {
  const pick = values => values[Math.floor(random() * values.length)];
  const expected = { points: 0, wrongRecords: 0 };

  closedBookSection("matching").prompts.forEach(prompt => {
    const roll = random();
    if (roll < 0.4) {
      chooseMatching(prompt.question, prompt.answer);
      expected.points++;
      return;
    }
    expected.wrongRecords++;
    if (roll < 0.7) {
      chooseMatching(prompt.question, prompt.answer === "Doom" ? "Pong" : "Doom");
    }
  });

  closedBookSection("true_false").questions.forEach((question, index) => {
    const roll = random();
    if (roll < 0.4) {
      clickTrueFalse(index, question.answer);
      expected.points++;
      return;
    }
    expected.wrongRecords++;
    if (roll < 0.7) clickTrueFalse(index, !question.answer);
  });

  for (const type of ["fill_in_the_blank", "fill_in_the_blank_list"]) {
    closedBookSection(type).questions.forEach(question => {
      const inputs = blanksFor(question.prompt);
      const groups = type === "fill_in_the_blank" ? question.answers : onePerAnswerGroup(question).map(answer => [answer]);
      const perBlank = type === "fill_in_the_blank" && groups.length === inputs.length && groups.every(Array.isArray);
      const used = new Set();
      let questionCredit = 0;

      inputs.forEach((input, blankIndex) => {
        const roll = random();
        if (roll < 0.4) {
          const candidates = perBlank ? groups[blankIndex] : groups.flat();
          const answer = candidates.find(candidate => !used.has(candidate));
          used.add(answer);
          input.value = random() < 0.5 ? `  ${answer.toUpperCase()} ` : answer;
          expected.points++;
          questionCredit++;
        } else if (roll < 0.6) {
          input.value = pick(ODD_ANSWERS.filter(odd => odd.length < 100));
        } else if (roll < 0.8) {
          input.value = pick(BLANK_ANSWERS);
        }
      });

      if (questionCredit < inputs.length) expected.wrongRecords++;
    });
  }

  return expected;
}

test("closed book: 40 seeded random mixes match an independent score count", async () => {
  for (let seed = 1; seed <= 40; seed++) {
    const random = seededRandom(seed);
    let expected;
    const attempt = await attemptClosedBook(() => { expected = answerRandomly(random); });
    assertScore(attempt, expected.points, `seed ${seed}`);
    assertEqual(attempt.result.wrongAnswers.length, expected.wrongRecords, `seed ${seed} wrong-answer records`);
  }
});

/* ---------- Submission behavior ---------- */

test("closed book: clicking Submit repeatedly sends one attempt", async () => {
  const attempt = await attemptClosedBook(() => {
    const submit = document.querySelector("#submitBtn");
    submit.addEventListener("click", () => { onSubmit(false); onSubmit(false); });
  });
  assertScore(attempt, 0);
});

test("closed book: a rejected email leaves the results on screen and tells the student", async () => {
  const attempt = await attemptClosedBook(() => answerRenderedClosedBookMidterm(true), {
    send: () => Promise.reject({ status: 0, text: "offline" })
  });
  assertEqual(attempt.emailOutcome.sent, false, "email outcome");
  assert(attempt.text.includes("You scored 100/100"), "results left the screen");
  assert(attempt.alerts.some(message => message.includes("notify your instructor")), "student was not told");
});

test("closed book: an email that never answers leaves the results on screen and tells the student", async () => {
  const attempt = await attemptClosedBook(() => answerRenderedClosedBookMidterm(true), {
    send: () => new Promise(() => {}),
    emailTimeoutMs: 10
  });
  assertEqual(attempt.emailOutcome.sent, false, "email outcome");
  assert(attempt.text.includes("You scored 100/100"), "results left the screen");
  assert(attempt.alerts.some(message => message.includes("notify your instructor")), "student was not told");
});

test("closed book: reaching the deadline grades typed answers and sends them before alerting", async () => {
  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  const events = [];
  globalThis.emailjs = {
    init() {},
    send: (_service, _template, params) => {
      events.push(params.message);
      return Promise.resolve({ status: 200 });
    }
  };

  try {
    resetTestState();
    await openRenderedClosedBookMidterm(false);
    globalThis.alert = message => events.push(message);
    typeBlanks("Atari's first hit game", ["pong"]);
    state.deadline = new Date(Date.now() - 1000);

    const giveUpAt = Date.now() + 3000;
    while (!events.some(event => event.includes("emailed successfully")) && Date.now() < giveUpAt) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    assert(state.submitted, "the deadline did not submit the exam");
    assert(document.querySelector("#app").textContent.includes("You scored 1/100"), "typed answer was not graded");
    assert(events[0].includes("Score: 1/100 (1%)."), `results were not sent first: ${String(events[0]).slice(0, 60)}`);
    assertEqual(events.filter(event => event.includes("Score:")).length, 1, "emails sent");
    assert(events.some(event => event.includes("out of time")), "student was not told time ran out");
  } finally {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
  }
});

test("closed book: logging in through the portal gives each accommodation its exam time", async () => {
  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  const previousCourseConfig = COURSE_CONFIG;
  const previousLoadJSON = loadJSON;
  globalThis.emailjs = { init() {}, send: () => Promise.resolve({ status: 200 }) };
  globalThis.alert = () => {};
  COURSE_CONFIG = { Game1270: { label: "Game 1270", termFolders: ["Fall2026"] } };

  try {
    for (const [accommodation, expectedMinutes] of [[undefined, 60], ["standard", 60], ["timeAndHalf", 90], ["doubleTime", 120]]) {
      resetTestState();
      const fixtures = {
        "Game1270/Fall2026/users.json": [{ username: "tester", password: "pass", fullName: "Test User", accommodation }],
        "Game1270/Fall2026/settings.json": { activeQuizzes: ["Midterm_ClosedBook"] }
      };
      loadJSON = (path, timeoutMs) => fixtures[path]
        ? Promise.resolve(fixtures[path])
        : previousLoadJSON(`/${path}`, timeoutMs);
      document.querySelector("#app").innerHTML =
        '<input id="username" value="tester"/><input id="password" value="pass"/><button id="loginBtn"></button>';

      await onLogin();
      document.querySelector(".quiz-option").click();
      const giveUpAt = Date.now() + 5000;
      while (!document.querySelector("#submitBtn") && Date.now() < giveUpAt) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      assert(document.querySelector("#submitBtn"), "exam did not open after login");
      assertEqual((state.deadline - state.startTime) / 60000, expectedMinutes, `${accommodation} exam minutes`);
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  } finally {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
    COURSE_CONFIG = previousCourseConfig;
    loadJSON = previousLoadJSON;
  }
});
