test("mixed exam awards full points for all correct answers", () => {
  const sections = [
    { type: "matching", points_per_question: 1, prompts: [{ question: "Match", answer: "Alpha" }], _sectionIndex: 0 },
    { type: "matching_pictures", points_per_question: 1, prompts: [{ question: "Picture", answer: "Beta" }], _sectionIndex: 1 },
    { type: "true_false", points_per_question: 1, questions: [{ question: "True?", answer: true }], _sectionIndex: 2 },
    { type: "multiple_choice", points_per_question: 1, prompts: [{ question: "Choose", correct_answer: "C" }], _sectionIndex: 3 },
    { type: "code_blocks_mc", points_per_question: 1, prompts: [{ question: "Code", correct_answer: "return 1;" }], _sectionIndex: 4 },
    { type: "fill_in_the_blank", questions: [{ prompt: "___ then ___", answers: [["first"], ["second"]] }], _sectionIndex: 5 },
    { type: "fill_in_the_blank_list", questions: [{ prompt: "___ and ___", answers: [["red", "blue"]] }], _sectionIndex: 6 },
    { type: "code_blocks_fitb", points_per_question: 1, questions: [{ prompt: "Code", answer: "token" }], _sectionIndex: 7 },
    { type: "coding_test", points_per_question: 2, title: "Coding", _sectionIndex: 8 }
  ];
  const answers = {
    "matching-0-0": "alpha",
    "matching_pictures-1-0": "BETA",
    "tf-2-0": true,
    "mc-3-0": "C",
    "cbmc-4-0": "return 1;",
    "coding_test-8": { passed: true, output: "4/4 passed" }
  };
  resetTestState(sections, answers);
  addTestInput("fib-input", 5, 0, " FIRST ");
  addTestInput("fib-input", 5, 0, "second");
  addTestInput("fibl-input", 6, 0, "red");
  addTestInput("fibl-input", 6, 0, "blue");
  addTestInput("cbfitb-input-inline", 7, 0, "token");

  const result = gradeQuiz();
  assertEqual(result.points, 12, "score");
  assertEqual(result.total, 12, "possible points");
  assertEqual(result.percent, 100, "percentage");
  assertEqual(result.wrongAnswers.length, 0, "incorrect answers");
});

test("incorrect, blank, and duplicate answers receive only one credit per accepted answer", () => {
  const sections = [
    { type: "matching", points_per_question: 1, prompts: [{ question: "Match", answer: "right" }], _sectionIndex: 0 },
    { type: "true_false", points_per_question: 1, questions: [{ question: "True?", answer: false }], _sectionIndex: 1 },
    { type: "multiple_choice", points_per_question: 1, prompts: [{ question: "Choose", correct_answer: "yes" }], _sectionIndex: 2 },
    { type: "code_blocks_mc", points_per_question: 1, prompts: [{ question: "Code", correct_answer: "right" }], _sectionIndex: 3 },
    { type: "fill_in_the_blank", questions: [{ prompt: "___ ___", answers: [["same"], ["same"]] }], _sectionIndex: 4 },
    { type: "fill_in_the_blank_list", questions: [{ prompt: "___ ___", answers: [["same"]] }], _sectionIndex: 5 },
    { type: "coding_test", points_per_question: 1, title: "Coding", _sectionIndex: 6 }
  ];
  const answers = {
    "matching-0-0": "wrong",
    "tf-1-0": true,
    "mc-2-0": "wrong",
    "cbmc-3-0": "wrong",
    "coding_test-6": { passed: false }
  };
  resetTestState(sections, answers);
  addTestInput("fib-input", 4, 0, "same");
  addTestInput("fib-input", 4, 0, "same");
  addTestInput("fibl-input", 5, 0, "same");
  addTestInput("fibl-input", 5, 0, "");

  const result = gradeQuiz();
  assertEqual(result.points, 2, "score");
  assertEqual(result.total, 9, "possible points");
  assertEqual(result.wrongAnswers.length, 7, "wrong-answer records");
});

test("very long, unicode, markup, and symbol answers are handled as ordinary incorrect text", () => {
  const oddAnswers = ["<script>alert(1)</script>", "🧪\n\t\\\"'`", "x".repeat(200000)];
  const sections = oddAnswers.map((answer, index) => ({
    type: "fill_in_the_blank",
    questions: [{ prompt: "___", answers: [["accepted"]] }],
    _sectionIndex: index
  }));
  resetTestState(sections);
  oddAnswers.forEach((answer, index) => addTestInput("fib-input", index, 0, answer));

  const result = gradeQuiz();
  assertEqual(result.points, 0, "score");
  assertEqual(result.total, 3, "possible points");
  assertEqual(result.wrongAnswers.length, 3, "wrong-answer records");
  assert(result.wrongAnswers[2].student.length > 100000, "long answer was truncated");
});

test("short answers preserve long and unusual text without affecting score", () => {
  const section = {
    type: "short_answer",
    title: "Open response",
    questions: [{ prompt: "Explain", answers: [["reference"]] }],
    _sectionIndex: 0
  };
  resetTestState([section]);
  const answer = document.createElement("textarea");
  answer.className = "sa-input";
  answer.dataset.section = "0";
  answer.dataset.question = "0";
  answer.value = "<tag>" + "z".repeat(100000) + " Ω";
  document.querySelector("#test-fixtures").appendChild(answer);

  const result = gradeQuiz();
  assertEqual(result.total, 0, "short-answer score total");
  assertEqual(result.shortAnswerResponses.length, 1, "response count");
  assertEqual(result.shortAnswerResponses[0].answer, answer.value, "preserved response");
});

test("empty short answer is represented explicitly", () => {
  resetTestState([{
    type: "short_answer",
    questions: [{ prompt: "Explain" }],
    _sectionIndex: 0
  }]);
  const result = gradeQuiz();
  assertEqual(result.shortAnswerResponses[0].answer, "(no answer)");
  assertEqual(result.shortAnswerResponses[0].correctAnswer, "(no answer provided)");
});

test("Likert responses are collected without adding scored points", () => {
  resetTestState([{
    type: "likert",
    prompts: [{ question: "Confidence" }],
    _sectionIndex: 0
  }], { "likert-0-0": { value: 4, label: "Completely" } });
  const result = gradeQuiz();
  assertEqual(result.total, 0, "survey score total");
  assertEqual(result.likertResponses[0].value, 4);
  assertEqual(result.likertResponses[0].label, "Completely");
});

function gradeListAnswers(question, typedAnswers) {
  resetTestState([{ type: "fill_in_the_blank_list", questions: [question], _sectionIndex: 0 }]);
  typedAnswers.forEach(answer => addTestInput("fibl-input", 0, 0, answer));
  return gradeQuiz();
}

test("list answers: answer_groups give each idea one point", () => {
  const question = { prompt: "___ ___", answer_groups: [["+", "plus"], ["-", "minus"]] };
  assertEqual(gradeListAnswers(question, ["+", "plus"]).points, 1, "same idea twice");
  assertEqual(gradeListAnswers(question, ["PLUS", " - "]).points, 2, "two ideas");
});

test("list answers: several nested answers lists are groups, one list is a pool", () => {
  const grouped = { prompt: "___ ___", answers: [["0", "zero"], ["1", "one"]] };
  assertEqual(gradeListAnswers(grouped, ["0", "zero"]).points, 1, "grouped spellings");
  assertEqual(gradeListAnswers(grouped, ["one", "zero"]).points, 2, "both groups in any order");

  const pool = { prompt: "___ ___", answers: [["red", "blue", "red"]] };
  assertEqual(gradeListAnswers(pool, ["red", "blue"]).points, 2, "pool entries are separate ideas");
  assertEqual(gradeListAnswers(pool, ["red", "red"]).points, 1, "repeat in a pool that lists an entry twice");
});

test("list answers: groups sharing a spelling are paired to give the most credit", () => {
  const question = { prompt: "___ ___", answer_groups: [["shared", "first"], ["shared"]] };
  assertEqual(gradeListAnswers(question, ["shared", "first"]).points, 2, "shared spelling moved to its other group");
  assertEqual(gradeListAnswers(question, ["first", "shared"]).points, 2, "order does not change credit");
  assertEqual(gradeListAnswers(question, ["shared", "shared"]).points, 1, "repeat across groups");
});

test("list answers: blanks, unknown text, and wrong-answer details", () => {
  const question = { prompt: "___ ___ ___", answer_groups: [["a", "alpha"], ["b"]] };
  const result = gradeListAnswers(question, ["ALPHA", "   ", "nope"]);
  assertEqual(result.points, 1, "score");
  assertEqual(result.total, 3, "possible points");
  assertEqual(result.wrongAnswers[0].student, "1/3 correct: alpha, (no answer), nope", "student detail");
  assertEqual(result.wrongAnswers[0].correct, "a / alpha, b", "accepted answers");
});
