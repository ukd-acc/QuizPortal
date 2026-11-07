test("matching renderer stores the selected answer", () => {
  resetTestState();
  const section = {
    title: "Match", instructions: "", _sectionIndex: 0,
    prompts: [{ question: "Name?", answer: "A" }],
    word_bank: [{ text: "A" }]
  };
  const rendered = renderMatchingSection(section);
  const select = rendered.querySelector("select");
  select.value = "A";
  select.dispatchEvent(new Event("change"));
  assertEqual(state.answers["matching-0-0"], "A");
});

test("matching-picture renderer stores the selected answer", () => {
  resetTestState();
  const rendered = renderMatchingPicturesSection({
    title: "Pictures", instructions: "", _sectionIndex: 1,
    prompts: [{ question: "Image?", image: "test.png", answer: "B" }],
    word_bank: [{ text: "B" }]
  });
  const select = rendered.querySelector("select");
  select.value = "B";
  select.dispatchEvent(new Event("change"));
  assertEqual(state.answers["matching_pictures-1-0"], "B");
});

test("true/false renderer stores boolean values", () => {
  resetTestState();
  const rendered = renderTFSection({
    title: "T/F", instructions: "", _sectionIndex: 2,
    questions: [{ question: "True?", answer: true }]
  });
  rendered.querySelectorAll(".tf-option")[1].click();
  assertEqual(state.answers["tf-2-0"], false);
});

test("multiple-choice renderer stores the chosen option", () => {
  resetTestState();
  const rendered = renderMCSection({
    title: "MC", instructions: "", _sectionIndex: 3,
    prompts: [{ question: "Choose", answers: ["A", "B"], correct_answer: "B" }]
  });
  rendered.querySelectorAll(".mc-option")[1].click();
  assertEqual(state.answers["mc-3-0"], "B");
});

test("code multiple-choice renderer stores code answers", () => {
  resetTestState();
  const rendered = renderCodeBlocksMCSection({
    title: "Code MC", instructions: "", _sectionIndex: 4,
    prompts: [{ question: "Which?", answers: [{ code: "return true;" }], correct_answer: "return true;" }]
  });
  rendered.querySelector(".cbmc-option").click();
  assertEqual(state.answers["cbmc-4-0"], "return true;");
});

test("fill-in-the-blank renderer creates one input per blank", () => {
  resetTestState();
  const rendered = renderFillInTheBlankSection({
    title: "FITB", instructions: "", _sectionIndex: 5,
    questions: [{ prompt: "___ plus ___", answers: [["one"], ["two"]] }]
  });
  assertEqual(rendered.querySelectorAll(".fib-input").length, 2);
});

test("fill-in-the-blank-list renderer creates one input per blank", () => {
  resetTestState();
  const rendered = renderFillInTheBlankListSection({
    title: "List", instructions: "", _sectionIndex: 6,
    questions: [{ prompt: "___ and ___", answers: [["one", "two"]] }]
  });
  assertEqual(rendered.querySelectorAll(".fibl-input").length, 2);
});

test("code-block fill-in-the-blank renderer creates inline inputs", () => {
  resetTestState();
  const rendered = renderCodeBlocksFITBSection({
    title: "Code FITB", instructions: "", _sectionIndex: 7,
    questions: [{ prompt: "Complete", code: "int value = __;", answer: "7" }]
  });
  assertEqual(rendered.querySelectorAll(".cbfitb-input-inline").length, 1);
  assertEqual(rendered.querySelectorAll(".cbfitb-input-after").length, 0);
});

test("code-block fill-in-the-blank renderer creates after-code input when needed", () => {
  resetTestState();
  const rendered = renderCodeBlocksFITBSection({
    title: "Code FITB", instructions: "", _sectionIndex: 7,
    questions: [{ prompt: "Output?", code: "Console.WriteLine(7);", answer: "7" }]
  });
  assertEqual(rendered.querySelectorAll(".cbfitb-input-after").length, 1);
});

test("short-answer renderer supports image alt text and Tab insertion", () => {
  resetTestState();
  const rendered = renderShortAnswerSection({
    title: "Open response", instructions: "", _sectionIndex: 8,
    questions: [{ prompt: "Explain", image: "diagram.png", image_alt: "Diagram" }]
  });
  const textarea = rendered.querySelector("textarea");
  assertEqual(rendered.querySelector("img").alt, "Diagram");
  textarea.value = "answer";
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  assertEqual(textarea.value, "answer    ");
});

test("Likert renderer stores selected scale value and label", () => {
  resetTestState();
  const rendered = renderLikertSection({
    title: "Survey", instructions: "", _sectionIndex: 9,
    scale_labels: ["Low", "High"], prompts: [{ question: "Confidence" }]
  });
  const input = rendered.querySelectorAll('input[type="radio"]')[1];
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  assertEqual(state.answers["likert-9-0"], { value: 1, label: "High" });
});

test("coding-test renderer exposes run and clear controls", () => {
  resetTestState();
  const rendered = renderCodingTestSection({
    title: "Coding", instructions: "", problem: "Return input", _sectionIndex: 10,
    testCases: [], startingCode: "class Solution {}"
  });
  assert(rendered.querySelector(".runCodeBtn"), "missing run button");
  assert(rendered.querySelector(".clearCodeBtn"), "missing clear button");
  assertEqual(rendered.querySelector("textarea").value, "class Solution {}");
});