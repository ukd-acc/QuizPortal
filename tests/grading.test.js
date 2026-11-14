const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

let inputsBySelector = {};
const gradingContext = {
  qsa: selector => inputsBySelector[selector] || [],
  qs: () => null,
  state: {},
  escapeHtml: value => String(value)
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "grading.js"), "utf8"),
  gradingContext,
  { filename: "grading.js" }
);

const matches = (answer, accepted) => gradingContext.blankAnswerMatches(answer, accepted);

test("matches missing, extra, substituted, and transposed letters", () => {
  assert.equal(matches("communicaton", ["communication"]), true);
  assert.equal(matches("communicationn", ["communication"]), true);
  assert.equal(matches("communicetion", ["communication"]), true);
  assert.equal(matches("envrionment artist", ["environment artist"]), true);
});

test("normalizes punctuation, spacing, casing, and accents", () => {
  assert.equal(matches("  CAMEL_case! ", ["camelCase"]), true);
  assert.equal(matches("résumé", ["resume"]), true);
  assert.equal(matches("multi line comment", ["multi-line comment"]), true);
});

test("accepts curated equivalent answers and rejects unrelated answers", () => {
  assert.equal(matches("fewer errors", ["lower error rate", "fewer errors"]), true);
  assert.equal(matches("communicaton", "communication"), true);
  assert.equal(matches("banana", ["communication", "environment artist"]), false);
});

test("does not fuzzy-match very short answers or accept empty input", () => {
  assert.equal(matches("1", ["1"]), true);
  assert.equal(matches("2", ["1"]), false);
  assert.equal(matches("", ["false"]), false);
});

test("bounds work for abnormally long input", () => {
  assert.equal(matches("x".repeat(5000), ["communication"]), false);
});

test("grades fill-in-the-blank typos and records misses without throwing", () => {
  inputsBySelector['.fib-input[data-section="2"][data-question="0"]'] = [
    { value: "communicaton" },
    { value: "environmnt artist" }
  ];
  const result = gradingContext.gradeFillInTheBlank({
    _sectionIndex: 2,
    questions: [{
      prompt: "___ ___",
      answers: [["communication"], ["environment artist"]]
    }]
  });
  assert.equal(result.correct, 2);
  assert.equal(result.wrongAnswers.length, 0);
});

test("allows the same answer in separate positional blanks", () => {
  inputsBySelector['.fib-input[data-section="5"][data-question="0"]'] = [
    { value: "yes" },
    { value: "yes" }
  ];
  const result = gradingContext.gradeFillInTheBlank({
    _sectionIndex: 5,
    questions: [{ prompt: "___ ___", answers: [["yes"], ["yes"]] }]
  });
  assert.equal(result.correct, 2);
  assert.equal(result.wrongAnswers.length, 0);
});

test("grades fill-in-the-blank lists against distinct answer groups", () => {
  inputsBySelector['.fibl-input[data-section="3"][data-question="0"]'] = [
    { value: "comprehensibilty" },
    { value: "reviewabilty" },
    { value: "fewer erors" }
  ];
  const result = gradingContext.gradeFillInTheBlankList({
    _sectionIndex: 3,
    questions: [{
      prompt: "___ ___ ___",
      answers: [
        ["comprehensibility", "comprehension"],
        ["reviewability", "easier to review"],
        ["lower error rate", "fewer errors"]
      ]
    }]
  });
  assert.equal(result.correct, 3);
  assert.equal(result.wrongAnswers.length, 0);
});

test("does not award two list blanks for synonyms in one answer group", () => {
  inputsBySelector['.fibl-input[data-section="4"][data-question="0"]'] = [
    { value: "camel" },
    { value: "camelCase" },
    { value: "PascalCase" }
  ];
  const result = gradingContext.gradeFillInTheBlankList({
    _sectionIndex: 4,
    questions: [{
      prompt: "___ ___ ___",
      answers: [
        ["camelCase", "camel case", "camel"],
        ["PascalCase", "pascal case", "pascal"],
        ["snake_case", "snake case", "snake"]
      ]
    }]
  });
  assert.equal(result.correct, 2);
  assert.equal(result.wrongAnswers.length, 1);
});
