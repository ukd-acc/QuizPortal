const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

let inputsBySelector = {};
const state = { answers: {}, quiz: { sections: [] } };
const gradingContext = {
  qsa: selector => inputsBySelector[selector] || [],
  qs: () => null,
  state,
  escapeHtml: value => String(value)
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "grading.js"), "utf8"),
  gradingContext,
  { filename: "grading.js" }
);

function setInputValues(selector, values) {
  inputsBySelector[selector] = values.map(value => ({ value }));
}

test("all application JavaScript parses and has no conflict markers", () => {
  for (const filename of ["grading.js", "email.js", "app.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", filename), "utf8");
    assert.doesNotMatch(source, /^(<<<<<<< |=======|>>>>>>> )/m, `${filename} contains a merge marker`);
    assert.doesNotThrow(() => new vm.Script(source, { filename }));
  }
});

test("fill-in-the-blank grades misspellings and maintains positional blanks", () => {
  setInputValues('.fib-input[data-section="0"][data-question="0"]', ["communicaton", "environment artist"]);
  const result = gradingContext.gradeFillInTheBlank({
    _sectionIndex: 0,
    questions: [{ prompt: "___ ___", answers: [["communication"], ["environment artist"]] }]
  });
  assert.equal(result.correct, 2);
  assert.equal(result.wrongAnswers.length, 0);
});

test("fill-in-the-blank-list supports typo matching and one-to-one answer groups", () => {
  setInputValues('.fibl-input[data-section="1"][data-question="0"]', ["comprehensibilty", "reviewabilty", "fewer erors"]);
  const question = {
    prompt: "___ ___ ___",
    answers: [
      ["comprehensibility", "comprehension"],
      ["reviewability", "easier to review"],
      ["lower error rate", "fewer errors"]
    ]
  };
  const result = gradingContext.gradeFillInTheBlankList({ _sectionIndex: 1, questions: [question] });
  assert.equal(result.correct, 3);
  assert.equal(result.wrongAnswers.length, 0);
});

test("synonyms for one list item cannot be counted twice", () => {
  setInputValues('.fibl-input[data-section="2"][data-question="0"]', ["camel", "camelCase", "PascalCase"]);
  const result = gradingContext.gradeFillInTheBlankList({
    _sectionIndex: 2,
    questions: [{
      prompt: "___ ___ ___",
      answers: [["camelCase", "camel case", "camel"], ["PascalCase", "pascal"], ["snake_case", "snake"]]
    }]
  });
  assert.equal(result.correct, 2);
  assert.equal(result.wrongAnswers.length, 1);
});

test("flat list answer pools count each distinct answer as its own idea", () => {
  setInputValues('.fibl-input[data-section="3"][data-question="0"]', ["communication", "planning"]);
  const result = gradingContext.gradeFillInTheBlankList({
    _sectionIndex: 3,
    questions: [{ prompt: "___ ___", answers: ["communication", "planning", "teamwork"] }]
  });
  assert.equal(result.correct, 2);
  assert.equal(result.wrongAnswers.length, 0);
});

test("empty and extremely long answers safely earn no fuzzy credit", () => {
  assert.equal(gradingContext.blankAnswerMatches("", ["communication"]), false);
  assert.equal(gradingContext.blankAnswerMatches("x".repeat(5000), ["communication"]), false);
});

test("coding-test sections are graded once and submitted result shape remains available", () => {
  const codingSection = {
    type: "coding_test",
    _sectionIndex: 0,
    title: "Coding test",
    points_per_question: 1,
    testCases: [{}, {}]
  };
  state.quiz = { sections: [codingSection] };
  state.answers = {
    "coding_test-0": {
      code: "solution",
      passed: true,
      testResults: [{ Passed: true }, { Passed: true }],
      output: "Passed 2/2"
    }
  };
  const result = gradingContext.gradeQuiz();
  assert.equal(result.points, 1);
  assert.equal(result.total, 1);
  assert.equal(result.codingTestResponses.length, 1);
});

test("coding tests remain gradable with the renderer's legacy answer shape", () => {
  state.quiz = {
    sections: [{
      type: "coding_test",
      _sectionIndex: 0,
      title: "Coding test",
      points_per_question: 2,
      testCases: [{}, {}, {}]
    }]
  };
  state.answers = { "coding_test-0": { code: "solution", passed: true, output: "Passed all tests" } };
  const result = gradingContext.gradeQuiz();
  assert.equal(result.points, 2);
  assert.equal(result.total, 2);
  assert.equal(result.codingTestResponses[0].status, "3/3 test cases passed — full credit");
});
