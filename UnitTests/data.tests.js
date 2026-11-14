// One accepted spelling per idea: what a student who knows every answer would type.
function onePerAnswerGroup(question) {
  return getListAnswerGroups(question).map(group => group[0]);
}

async function findQuizSettings(folder, depth = 0) {
  if (depth > 2) return [];
  const response = await fetch(`/${folder}/`);
  if (!response.ok) return [];
  const listing = new DOMParser().parseFromString(await response.text(), "text/html");
  const results = [];

  const hasSettingsLink = Array.from(listing.querySelectorAll("a[href]"))
    .some(link => link.getAttribute("href") === "settings.json");
  if (hasSettingsLink && depth > 0) {
    const settingsResponse = await fetch(`/${folder}/settings.json`);
    if (!settingsResponse.ok) throw new Error(`Could not load ${folder}/settings.json`);
    const text = stripJsonComments(await settingsResponse.text());
    const settings = JSON.parse(text);
    if (Array.isArray(settings.sections) && settings.sections.length) {
      results.push({ folder, settings });
    }
  }

  if (depth === 2) return results;
  const children = Array.from(listing.querySelectorAll("a[href]"))
    .map(link => ({
      path: decodeURIComponent(new URL(link.getAttribute("href"), new URL(`/${folder}/`, location.origin)).pathname).replace(/^\/+|\/+$/g, ""),
      isDirectory: link.getAttribute("href").endsWith("/")
    }))
    .filter(link => link.isDirectory)
    .map(link => link.path)
    .filter(path => path.startsWith(`${folder}/`) && path.split("/").length === folder.split("/").length + 1)
    .filter(path => !path.endsWith("images"));

  for (const child of children) {
    results.push(...await findQuizSettings(child, depth + 1));
  }
  return results;
}

test("all configured quiz folders load valid supported section JSON", async () => {
  resetTestState();
  const settingsList = [];
  for (const course of ["Game1270", "Game1371", "Game1377"]) {
    settingsList.push(...await findQuizSettings(course));
  }
  assert(settingsList.length > 0, "no quiz settings were discovered; run this page through the local HTTP server");
  const supportedTypes = new Set([
    "matching", "true_false", "matching_pictures", "multiple_choice", "likert",
    "code_blocks_mc", "fill_in_the_blank", "code_blocks_fitb", "fill_in_the_blank_list",
    "short_answer", "coding_test"
  ]);
  const failures = [];
  let sectionCount = 0;

  for (const { folder, settings } of settingsList) {
    for (const meta of settings.sections) {
      try {
        const response = await fetch(`/${folder}/${meta.file}`);
        assert(response.ok, `missing ${folder}/${meta.file}`);
        const loaded = JSON.parse(stripJsonComments(await response.text()));
        for (const section of Array.isArray(loaded) ? loaded : [loaded]) {
          sectionCount++;
          assert(supportedTypes.has(section.type), `unsupported section type ${section.type} in ${folder}/${meta.file}`);
          const validQuestionShape = section.type === "coding_test"
            ? Array.isArray(section.testCases)
            : section.type === "likert" ||
              ["matching", "matching_pictures", "multiple_choice", "code_blocks_mc"].includes(section.type)
              ? Array.isArray(section.prompts)
              : Array.isArray(section.questions);
          assert(validQuestionShape, `missing question list in ${folder}/${meta.file}`);
          if (section.type === "fill_in_the_blank_list") {
            for (const question of section.questions) {
              const blankCount = (question.prompt.match(/___/g) || []).length;
              const groups = getListAnswerGroups(question);
              assert(groups.length >= blankCount, `fewer answer groups than blanks: ${question.prompt}`);
              const spellings = groups.flat();
              const plural = spellings.find(answer => spellings.includes(`${answer}s`) &&
                !groups.some(group => group.includes(answer) && group.includes(`${answer}s`)));
              assert(plural === undefined, `"${plural}" and its plural can earn two points: ${question.prompt}`);
            }
          }
          state.quiz = { sections: [section] };
          section._sectionIndex = 0;
          state.answers = {};
          const result = gradeQuiz();
          assert(Number.isFinite(result.points) && Number.isFinite(result.total), `non-finite score in ${folder}/${meta.file}`);
        }
      } catch (error) {
        failures.push(`${folder}/${meta.file}: ${error.message}`);
      }
    }
  }

  assertEqual(failures, [], "quiz data failures");
  assert(sectionCount >= 30, `expected broad coverage, checked only ${sectionCount} sections`);
});

test("Game1270 closed-book midterm grades a complete correct and incorrect attempt", async () => {
  const folder = "Game1270/Midterm_ClosedBook";
  const settings = JSON.parse(stripJsonComments(await (await fetch(`/${folder}/settings.json`)).text()));
  const sections = [];

  for (const meta of settings.sections) {
    const response = await fetch(`/${folder}/${meta.file}`);
    assert(response.ok, `missing ${folder}/${meta.file}`);
    const loaded = JSON.parse(stripJsonComments(await response.text()));
    for (const section of Array.isArray(loaded) ? loaded : [loaded]) {
      section._sectionIndex = sections.length;
      sections.push(section);
    }
  }

  const correctAnswers = {};
  resetTestState(sections, correctAnswers);
  for (const section of sections) {
    if (section.type === "matching") {
      section.prompts.forEach((question, index) => {
        correctAnswers[`matching-${section._sectionIndex}-${index}`] = question.answer;
      });
    } else if (section.type === "true_false") {
      section.questions.forEach((question, index) => {
        correctAnswers[`tf-${section._sectionIndex}-${index}`] = question.answer;
      });
    } else if (section.type === "fill_in_the_blank") {
      section.questions.forEach((question, questionIndex) => {
        const blankCount = (question.prompt.match(/___/g) || []).length;
        const groups = question.answers || [];
        const perBlank = groups.length === blankCount && groups.every(Array.isArray);
        const pool = perBlank ? null : groups.flat().filter(answer => typeof answer === "string");
        const used = new Set();
        for (let blankIndex = 0; blankIndex < blankCount; blankIndex++) {
          const candidates = perBlank ? groups[blankIndex] : pool;
          const answer = candidates.find(candidate => !used.has(candidate));
          assert(answer !== undefined, `not enough distinct answers for ${question.prompt}`);
          used.add(answer);
          addTestInput("fib-input", section._sectionIndex, questionIndex, answer);
        }
      });
    } else if (section.type === "fill_in_the_blank_list") {
      section.questions.forEach((question, questionIndex) => {
        const blankCount = (question.prompt.match(/___/g) || []).length;
        const answers = onePerAnswerGroup(question);
        assert(answers.length >= blankCount, `not enough list answers for ${question.prompt}`);
        answers.slice(0, blankCount).forEach(answer =>
          addTestInput("fibl-input", section._sectionIndex, questionIndex, answer));
      });
    }
  }

  let result = gradeQuiz();
  assertEqual(result.points, result.total, "all-correct exam score");
  assertEqual(result.total, 100, "closed-book exam points");
  assertEqual(result.wrongAnswers.length, 0, "all-correct wrong-answer records");

  const incorrectAnswers = {};
  resetTestState(sections, incorrectAnswers);
  let expectedWrongQuestions = 0;
  for (const section of sections) {
    if (section.type === "matching") {
      section.prompts.forEach((question, index) => {
        incorrectAnswers[`matching-${section._sectionIndex}-${index}`] = "definitely not correct";
        expectedWrongQuestions++;
      });
    } else if (section.type === "true_false") {
      section.questions.forEach((question, index) => {
        incorrectAnswers[`tf-${section._sectionIndex}-${index}`] = !question.answer;
        expectedWrongQuestions++;
      });
    } else if (section.type === "fill_in_the_blank" || section.type === "fill_in_the_blank_list") {
      const className = section.type === "fill_in_the_blank" ? "fib-input" : "fibl-input";
      section.questions.forEach((question, questionIndex) => {
        const blankCount = (question.prompt.match(/___/g) || []).length;
        for (let blankIndex = 0; blankIndex < blankCount; blankIndex++) {
          addTestInput(className, section._sectionIndex, questionIndex, "definitely not correct");
        }
        if (blankCount > 0) expectedWrongQuestions++;
      });
    }
  }

  result = gradeQuiz();
  assertEqual(result.points, 0, "all-incorrect exam score");
  assertEqual(result.total, 100, "all-incorrect exam points");
  assertEqual(result.wrongAnswers.length, expectedWrongQuestions, "all-incorrect question records");
});

test("Game1270 midterm open-book and closed-book are both timed for 60 minutes", async () => {
  for (const folder of ["Game1270/Midterm_ClosedBook", "Game1270/Midterm_OpenBook"]) {
    const response = await fetch(`/${folder}/settings.json`);
    assert(response.ok, `missing settings for ${folder}`);
    const settings = JSON.parse(stripJsonComments(await response.text()));
    assertEqual(settings.timed, true, `${folder} timed flag`);
    assertEqual(settings.durationMinutes, 60, `${folder} duration`);
  }
});

async function openRenderedClosedBookMidterm(mockEmail = true) {
  state.selectedCourse = "Game1270";
  state.selectedQuizFolder = "Midterm_ClosedBook";
  state.user = { username: "unit-test", fullName: "Unit Test", accommodation: "standard" };
  if (mockEmail) {
    globalThis.emailjs = { init() {}, send: () => Promise.resolve({ status: 200 }) };
  }
  globalThis.alert = () => {};
  const originalLoadJSON = loadJSON;
  loadJSON = (path, timeoutMs) => originalLoadJSON(`/${path}`, timeoutMs);
  try {
    await initQuiz();
  } finally {
    loadJSON = originalLoadJSON;
  }
  assertEqual(state.quiz.title, "Midterm_ClosedBook", "rendered quiz title");
  assert(document.querySelector("#submitBtn"), "exam submit button was not rendered");
}

// Clicks Submit and waits for the email outcome, so its alert fires while the test's stub is installed.
async function submitRenderedAttempt(emailTimeoutMs) {
  const originalSend = globalThis.sendResultsByEmail;
  let result;
  let pendingEmail;
  globalThis.sendResultsByEmail = gradedResult => {
    result = gradedResult;
    pendingEmail = originalSend(gradedResult, emailTimeoutMs);
    return pendingEmail;
  };

  try {
    document.querySelector("#submitBtn").click();
    return { result, emailOutcome: await pendingEmail };
  } finally {
    globalThis.sendResultsByEmail = originalSend;
  }
}

function answerRenderedClosedBookMidterm(allCorrect) {
  for (const section of state.quiz.sections) {
    const sectionElement = document.querySelector(`#section-${section._sectionIndex}`);

    if (section.type === "matching") {
      section.prompts.forEach((question, index) => {
        const select = sectionElement.querySelectorAll("select")[index];
        if (allCorrect) {
          select.value = question.answer;
        } else {
          select.value = Array.from(select.options)
            .map(option => option.value)
            .find(value => value && value.toLowerCase() !== question.answer.toLowerCase()) || "";
        }
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    } else if (section.type === "true_false") {
      section.questions.forEach((question, index) => {
        const options = sectionElement.querySelectorAll(".tf-row")[index].querySelectorAll(".tf-option");
        options[allCorrect ? Number(!question.answer) : Number(question.answer)].click();
      });
    } else if (section.type === "fill_in_the_blank") {
      section.questions.forEach((question, questionIndex) => {
        const inputs = sectionElement.querySelectorAll(`.fib-input[data-section="${section._sectionIndex}"][data-question="${questionIndex}"]`);
        const answerGroups = question.answers || [];
        const answersPerBlank = answerGroups.length === inputs.length && answerGroups.every(Array.isArray);
        const answerPool = answerGroups.flat().filter(answer => typeof answer === "string");
        const usedAnswers = new Set();

        inputs.forEach((input, blankIndex) => {
          if (!allCorrect) {
            input.value = "definitely not a valid answer";
            return;
          }
          const candidates = answersPerBlank ? answerGroups[blankIndex] : answerPool;
          const answer = candidates.find(candidate => !usedAnswers.has(candidate.toLowerCase()));
          assert(answer !== undefined, `no distinct correct response for ${question.prompt}`);
          input.value = answer;
          usedAnswers.add(answer.toLowerCase());
        });
      });
    } else if (section.type === "fill_in_the_blank_list") {
      section.questions.forEach((question, questionIndex) => {
        const inputs = sectionElement.querySelectorAll(`.fibl-input[data-section="${section._sectionIndex}"][data-question="${questionIndex}"]`);
        const answers = onePerAnswerGroup(question);

        inputs.forEach((input, blankIndex) => {
          if (!allCorrect) {
            input.value = "definitely not a valid answer";
            return;
          }
          assert(answers[blankIndex] !== undefined, `not enough distinct list answers for ${question.prompt}`);
          input.value = answers[blankIndex];
        });
      });
    }
  }
}

test("student completes the rendered Game1270 closed-book midterm correctly and submits", async () => {
  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  try {
    await openRenderedClosedBookMidterm();
    answerRenderedClosedBookMidterm(true);
    await submitRenderedAttempt();
    assert(state.submitted, "clicking Submit did not submit the exam");
    assert(document.querySelector("#app").textContent.includes("You scored 100/100"), "student did not receive a 100/100 summary");
  } finally {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
  }
});

test("student submits the rendered Game1270 closed-book midterm with all incorrect answers", async () => {
  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  try {
    await openRenderedClosedBookMidterm();
    answerRenderedClosedBookMidterm(false);
    await submitRenderedAttempt();
    assert(state.submitted, "clicking Submit did not submit the exam");
    assert(document.querySelector("#app").textContent.includes("You scored 0/100"), "all-wrong attempt did not score 0/100");
  } finally {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
  }
});

// The crawl above grades without rendering, so no input exists and the answer-comparison
// code never runs. This opens each quiz the way a student does and submits typed answers.
test("every quiz renders, accepts answers, submits, and emails once", async () => {
  const quizzes = [];
  for (const course of ["Game1270", "Game1371", "Game1377"]) {
    quizzes.push(...await findQuizSettings(course));
  }
  assert(quizzes.length > 0, "no quiz settings were discovered; run this page through the local HTTP server");

  const previousEmailJS = globalThis.emailjs;
  const previousAlert = globalThis.alert;
  const previousLoadJSON = loadJSON;
  const failures = [];
  let sends = 0;
  globalThis.emailjs = { init() {}, send: () => { sends++; return Promise.resolve({ status: 200 }); } };
  globalThis.alert = () => {};
  loadJSON = (path, timeoutMs) => previousLoadJSON(`/${path}`, timeoutMs);

  try {
    for (const { folder } of quizzes) {
      const [course, ...quizPath] = folder.split("/");
      resetTestState();
      sends = 0;
      state.selectedCourse = course;
      state.selectedQuizFolder = quizPath.join("/");
      state.user = { username: "unit-test", fullName: "Unit Test", accommodation: "standard" };

      try {
        await initQuiz();
        const submit = document.querySelector("#submitBtn");
        assert(submit, "quiz did not open");
        document.querySelectorAll("#sections select").forEach(select => {
          select.selectedIndex = select.options.length - 1;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        document.querySelectorAll('#sections input[type="text"], #sections textarea').forEach(input => {
          input.value = "unit test answer";
        });
        document.querySelectorAll("#sections .tf-option, #sections .mc-option, #sections .cbmc-option")
          .forEach(option => option.click());
        await submitRenderedAttempt();
        assert(state.submitted, "submit did not complete");
        assert(document.querySelector("#app").textContent.includes("Quiz Summary"), "summary was not rendered");
        assertEqual(sends, 1, "email sends");
      } catch (error) {
        failures.push(`${folder}: ${error.message}`);
      } finally {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
      }
    }
  } finally {
    globalThis.emailjs = previousEmailJS;
    globalThis.alert = previousAlert;
    loadJSON = previousLoadJSON;
  }

  assertEqual(failures, [], "rendered quiz failures");
});
