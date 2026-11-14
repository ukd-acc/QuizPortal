/* ---------- GRADING ---------- */
function gradeShortAnswer(section) {
  const responses = [];

  section.questions.forEach((q, idx) => {
    const textarea = qs(`.sa-input[data-section="${section._sectionIndex}"][data-question="${idx}"]`);
    const userAnswer = textarea ? textarea.value.trim() : "";
    responses.push({
      sectionTitle: section.title,
      question: q.prompt,
      answer: userAnswer || "(no answer)",
      correctAnswer: Array.isArray(q.answers) ? q.answers.flat().join(" or ") || "(no answer provided)" : "(no answer provided)"
    });
  });

  return responses;
}

function normalizeBlankAnswer(answer) {
  return String(answer ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function blankAnswerEditDistance(left, right, maxDistance) {
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;

  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i++) rows[i][0] = i;
  for (let j = 0; j <= right.length; j++) rows[0][j] = j;

  for (let i = 1; i <= left.length; i++) {
    let rowMinimum = maxDistance + 1;
    for (let j = 1; j <= right.length; j++) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + substitutionCost
      );

      // Treat an adjacent letter transposition as one typo (e.g. "teh").
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
      rowMinimum = Math.min(rowMinimum, rows[i][j]);
    }
    if (rowMinimum > maxDistance) return maxDistance + 1;
  }

  return rows[left.length][right.length];
}

function blankAnswerMatches(userAnswer, acceptedAnswers) {
  const normalizedUserAnswer = normalizeBlankAnswer(userAnswer);
  if (!normalizedUserAnswer) return false;

  const answerOptions = Array.isArray(acceptedAnswers) ? acceptedAnswers : [acceptedAnswers];
  const normalizedAcceptedAnswers = answerOptions
    .filter(answer => typeof answer === "string")
    .map(normalizeBlankAnswer)
    .filter(Boolean);
  if (normalizedAcceptedAnswers.includes(normalizedUserAnswer)) return true;

  // Avoid expensive work on unusually long input. Short answers are exact-only
  // because one edit could turn them into an entirely different answer.
  if (normalizedUserAnswer.length > 128 || normalizedUserAnswer.length < 4) return false;

  return normalizedAcceptedAnswers.some(acceptedAnswer => {
    if (acceptedAnswer.length < 4 || acceptedAnswer.length > 128) return false;
    const maxDistance = Math.max(normalizedUserAnswer.length, acceptedAnswer.length) >= 8 ? 2 : 1;
    const distance = blankAnswerEditDistance(normalizedUserAnswer, acceptedAnswer, maxDistance);
    return distance <= maxDistance && distance / Math.max(normalizedUserAnswer.length, acceptedAnswer.length) <= 0.2;
  });
}

function gradeFillInTheBlank(section) {
  let correct = 0;
  const wrongAnswers = [];

  section.questions.forEach((q, idx) => {
    const inputs = qsa(`.fib-input[data-section="${section._sectionIndex}"][data-question="${idx}"]`); // Select inputs for this section and question
    const usedAnswers = new Set();
    let questionCorrect = true; // Track if the entire question is correct
    const studentAnswers = []; // Collect all user answers for the question
    const hasAnswersPerBlank = q.answers.length === inputs.length && q.answers.every(Array.isArray);

    inputs.forEach((input, blankIdx) => {
      const userAnswer = input.value.trim();
      // One nested list per blank is positional; otherwise all answers form a shared pool.
      const rawAnswers = hasAnswersPerBlank ? q.answers[blankIdx] : q.answers.flat();
      studentAnswers.push(userAnswer || "(no answer)");

      const isCorrect = blankAnswerMatches(userAnswer, rawAnswers);
      const normalizedAnswer = normalizeBlankAnswer(userAnswer);
      if (isCorrect && (hasAnswersPerBlank || !usedAnswers.has(normalizedAnswer))) {
        correct++;
        usedAnswers.add(normalizedAnswer); // Prevent duplicate credit for a shared answer pool
      } else {
        questionCorrect = false; // Mark the question as incorrect
      }
    });

    // Add to wrongAnswers only once per question
    if (!questionCorrect) {
      wrongAnswers.push({
        type: "Fill in the Blank",
        question: q.prompt,
        student: studentAnswers.join(", "),
        correct: q.answers.map(answerGroup =>
          Array.isArray(answerGroup) ? answerGroup.join(", ") : answerGroup
        ).join(" | ") // Combine all possible answers
      });
    }
  });

  return { correct, wrongAnswers };
}

// Each group is one accepted idea; its entries are spellings of that idea.
// `answer_groups`, or `answers` with several nested lists, are groups as written.
// A single flat list is a pool in which every entry is its own idea.
function getListAnswerGroups(question) {
  const source = question.answer_groups || question.answers || [];
  const isGrouped = Boolean(question.answer_groups) || (source.length > 0 && source.every(Array.isArray));
  const groups = isGrouped ? source : source.flat().map(answer => [answer]);

  return groups.map(group => (Array.isArray(group) ? group : [group])
    .filter(answer => typeof answer === "string")
    .map(normalizeBlankAnswer));
}

// Largest one-to-one pairing of student answers to groups, so one idea earns one
// point however it is spelled, and groups that share a spelling cannot cost credit.
function countMatchedAnswerGroups(studentAnswers, groups) {
  const inputForGroup = new Array(groups.length).fill(-1);
  const compatibleGroupsByInput = studentAnswers.map(answer =>
    groups.map(group => blankAnswerMatches(answer, group))
  );

  const assignToGroup = (inputIndex, visitedGroups) => {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      if (visitedGroups.has(groupIndex) || !compatibleGroupsByInput[inputIndex][groupIndex]) continue;
      visitedGroups.add(groupIndex);

      if (inputForGroup[groupIndex] === -1 || assignToGroup(inputForGroup[groupIndex], visitedGroups)) {
        inputForGroup[groupIndex] = inputIndex;
        return true;
      }
    }
    return false;
  };

  const usedAnswers = new Set();
  let matchedCount = 0;
  studentAnswers.forEach((answer, inputIndex) => {
    if (!answer || usedAnswers.has(answer)) return false; // Prevent duplicate credit for the same answer
    usedAnswers.add(answer);
    if (assignToGroup(inputIndex, new Set())) matchedCount++;
  });
  return matchedCount;
}

function gradeFillInTheBlankList(section) {
  let correct = 0;
  const wrongAnswers = [];

  section.questions.forEach((q, idx) => {
    const inputs = qsa(`.fibl-input[data-section="${section._sectionIndex}"][data-question="${idx}"]`); // Select inputs for this section and question
    const studentAnswers = inputs.map(input => normalizeBlankAnswer(input.value));
    const answerGroups = getListAnswerGroups(q);
    const questionCorrectCount = countMatchedAnswerGroups(studentAnswers, answerGroups);
    correct += questionCorrectCount;
    const possibleAnswers = answerGroups.flat();

    // Add a single entry to wrongAnswers for the entire question
    if (questionCorrectCount < inputs.length) {
      wrongAnswers.push({
        type: "Fill in the Blank List",
        question: q.prompt,
        student: `${questionCorrectCount}/${inputs.length} correct: ${studentAnswers.map(answer => answer || "(no answer)").join(", ")}`,
        correct: answerGroups.map(group => group.join(" / ")).join(", ")
      });
    }
  });

  return { correct, wrongAnswers };
}

function gradeCodeBlocksFITB(section) {
  let correct = 0;
  const wrongAnswers = [];

  section.questions.forEach((q, idx) => {
    total += section.points_per_question;
    
    // Get all inputs for this question (both inline and after-code)
    const inlineInputs = qsa(`.cbfitb-input-inline[data-question="${idx}"]`);
    const afterInputs = qsa(`.cbfitb-input-after[data-question="${idx}"]`);
    const allInputs = [...inlineInputs, ...afterInputs];
    
    if (allInputs.length === 0) {
      // No input found, count as wrong
      wrongAnswers.push({
        type: "Code Analysis - Fill in Blank",
        question: q.prompt,
        student: "(no answer)",
        correct: Array.isArray(q.answer) ? q.answer.join(" or ") : q.answer
      });
      return;
    }

    // Normalize accepted answers to lowercase
    const acceptedAnswers = Array.isArray(q.answer) ? 
      q.answer.map(a => a.toLowerCase()) : 
      [q.answer.toLowerCase()];

    let questionCorrect = true;
    const studentAnswers = [];

    allInputs.forEach((input) => {
      const userAnswer = input.value.trim().toLowerCase();
      studentAnswers.push(userAnswer || "(no answer)");

      if (!acceptedAnswers.includes(userAnswer)) {
        questionCorrect = false;
      }
    });

    if (questionCorrect) {
      correct += section.points_per_question;
    } else {
      wrongAnswers.push({
        type: "Code Analysis - Fill in Blank",
        question: q.prompt,
        student: studentAnswers.join(", "),
        correct: Array.isArray(q.answer) ? q.answer.join(" or ") : q.answer
      });
    }
  });

  return { correct, wrongAnswers };
}

function gradeQuiz() {
  let points = 0, total = 0;
  const wrongAnswers = [];
  const shortAnswerResponses = [];
  const codingTestResponses = [];
  const likertResponses = [];

  state.quiz.sections.forEach(section => {
    if (section.type === "matching") {
      section.prompts.forEach((q, idx) => {
        total += section.points_per_question;
        const studentAnswer = state.answers[`matching-${section._sectionIndex}-${idx}`];

        if (studentAnswer && studentAnswer.toLowerCase() === q.answer.toLowerCase()) {
          points += section.points_per_question;
        } else {
          wrongAnswers.push({
            type: "Matching",
            question: q.question,
            student: studentAnswer || "(no answer)",
            correct: q.answer
          });
        }
      });
    }

    else if (section.type === "matching_pictures") {
      section.prompts.forEach((q, idx) => {
        total += section.points_per_question;
        const studentAnswer = state.answers[`matching_pictures-${section._sectionIndex}-${idx}`];

        if (studentAnswer && studentAnswer.toLowerCase() === q.answer.toLowerCase()) {
          points += section.points_per_question;
        } else {
          wrongAnswers.push({
            type: "Matching Pictures",
            question: q.question,
            student: studentAnswer || "(no answer)",
            correct: q.answer
          });
        }
      });
    }

    else if (section.type === "true_false") {
      section.questions.forEach((q, idx) => {
        total += section.points_per_question;
        const studentAnswer = state.answers[`tf-${section._sectionIndex}-${idx}`];

        if (typeof studentAnswer !== "undefined" && studentAnswer === q.answer) {
          points += section.points_per_question;
        } else {
          wrongAnswers.push({
            type: "True/False",
            question: q.question,
            student: typeof studentAnswer === "undefined" ? "(no answer)" : studentAnswer,
            correct: q.answer
          });
        }
      });
    }

    else if (section.type === "multiple_choice") {
      section.prompts.forEach((q, idx) => {
        total += section.points_per_question;
        const studentAnswer = state.answers[`mc-${section._sectionIndex}-${idx}`];

        if (studentAnswer && studentAnswer === q.correct_answer) {
          points += section.points_per_question;
        } else {
          wrongAnswers.push({
            type: "Multiple Choice",
            question: q.question,
            student: studentAnswer || "(no answer)",
            correct: q.correct_answer
          });
        }
      });
    }

    else if (section.type === "code_blocks_mc") {
      section.prompts.forEach((q, idx) => {
        total += section.points_per_question;
        const studentAnswer = state.answers[`cbmc-${section._sectionIndex}-${idx}`];

        if (studentAnswer && studentAnswer === q.correct_answer) {
          points += section.points_per_question;
        } else {
          wrongAnswers.push({
            type: "Code Analysis - Multiple Choice",
            question: q.question,
            student: studentAnswer || "(no answer)",
            correct: q.correct_answer
          });
        }
      });
    }

    else if (section.type === "fill_in_the_blank") {
      const result = gradeFillInTheBlank(section);
      points += result.correct;

      // Count total blanks by counting the number of "___" in each prompt
      total += section.questions.reduce((sum, q) => {
        const blankCount = (q.prompt.match(/___/g) || []).length; // Count "___" in the prompt
        return sum + blankCount;
      }, 0);

      wrongAnswers.push(...result.wrongAnswers);
    }

    else if (section.type === "code_blocks_fitb") {
      section.questions.forEach((q, idx) => {
        total += section.points_per_question;
        
        // Get all inputs for this question (both inline and after-code)
        const inlineInputs = qsa(`.cbfitb-input-inline[data-section="${section._sectionIndex}"][data-question="${idx}"]`);
        const afterInputs = qsa(`.cbfitb-input-after[data-section="${section._sectionIndex}"][data-question="${idx}"]`);
        const allInputs = [...inlineInputs, ...afterInputs];
        
        if (allInputs.length === 0) {
          // No input found, count as wrong
          wrongAnswers.push({
            type: "Code Analysis - Fill in Blank",
            question: q.prompt || q.code,
            student: "(no answer)",
            correct: Array.isArray(q.answer) ? q.answer.join(" or ") : q.answer
          });
          return;
        }

        // Normalize accepted answers to lowercase
        const acceptedAnswers = Array.isArray(q.answer) ? 
          q.answer.map(a => a.toLowerCase()) : 
          [q.answer.toLowerCase()];

        let questionCorrect = true;
        const studentAnswers = [];

        allInputs.forEach((input) => {
          const userAnswer = input.value.trim().toLowerCase();
          studentAnswers.push(userAnswer || "(no answer)");

          if (!acceptedAnswers.includes(userAnswer)) {
            questionCorrect = false;
          }
        });

        if (questionCorrect) {
          points += section.points_per_question;
        } else {
          wrongAnswers.push({
            type: "Code Analysis - Fill in Blank",
            question: q.prompt || q.code,
            student: studentAnswers.join(", "),
            correct: Array.isArray(q.answer) ? q.answer.join(" or ") : q.answer
          });
        }
      });
    }

    else if (section.type === "fill_in_the_blank_list") {
      const result = gradeFillInTheBlankList(section);
      points += result.correct;
      total += section.questions.reduce((sum, q) => {
        const blankCount = (q.prompt.match(/___/g) || []).length; // Count "___" in the prompt
        return sum + blankCount;
      }, 0);
      wrongAnswers.push(...result.wrongAnswers);
    }

    else if (section.type === "coding_test") {
      const score = Number(section.points_per_question) || 0;
      const studentAnswer = state.answers[`coding_test-${section._sectionIndex}`];
      const testCases = Array.isArray(section.testCases) ? section.testCases : [];
      const passedCount = Array.isArray(studentAnswer?.testResults)
        ? studentAnswer.testResults.filter(test => test.Passed || test.passed).length
        : studentAnswer?.passed ? testCases.length : 0;
      const passed = testCases.length > 0 && Boolean(studentAnswer?.passed) && passedCount === testCases.length;

      total += score;
      if (passed) points += score;

      codingTestResponses.push({
        sectionTitle: section.title,
        question: section.problem || section.title,
        code: studentAnswer?.code || "(not submitted)",
        status: studentAnswer
          ? `${passedCount}/${testCases.length} test cases passed${passed ? " — full credit" : " — no credit"}`
          : `Not run — 0/${testCases.length} test cases passed`,
        output: studentAnswer?.output || ""
      });

      if (!passed) {
        wrongAnswers.push({
          type: "Coding Test",
          question: section.title,
          student: studentAnswer ? `${passedCount}/${testCases.length} test cases passed` : "(not run)",
          correct: testCases.length > 0 ? `Pass all ${testCases.length} test cases` : "No test cases are configured"
        });
      }
    }

    else if (section.type === "short_answer") {
      shortAnswerResponses.push(...gradeShortAnswer(section));
    }
    else if (section.type === "likert") {
      // Collect likert responses (survey) but do not affect scoring
      section.prompts.forEach((q, idx) => {
        const secIdx = typeof section._sectionIndex !== 'undefined' ? section._sectionIndex : 0;
        const key = `likert-${secIdx}-${idx}`;
        const resp = state.answers[key];
        likertResponses.push({ question: q.question, value: resp ? resp.value : null, label: resp ? resp.label : null });
      });
    }
  });

  const percent = total > 0 ? Math.round((points / total) * 100) : 0;

  return { points, total, percent, wrongAnswers, shortAnswerResponses, codingTestResponses, likertResponses };
}

/* ---------- SUMMARY ---------- */
function showSummary(res) {
  const app = qs("#app");
  app.innerHTML = `
    <div class="container">
      <div class="card">
        <h2>Quiz Summary</h2>
  ${res.total > 0 ? `<p>You scored <strong>${res.points}/${res.total}</strong> (${res.percent}%).</p>` : `<p><em>No score for survey-only quizzes.</em></p>`}
        ${res.shortAnswerResponses.length ? `<h3>Short Answer Responses (instructor review)</h3>
        <p>Free-response answers are included for instructor review and are not auto-scored.</p>
        <ul class="short-answer-list">
          ${res.shortAnswerResponses.map((r, i) =>
            `<li>${r.sectionTitle ? `<em>${escapeHtml(r.sectionTitle)}</em><br/>` : ""}<strong>${escapeHtml(r.question)}</strong><br/>
             <span class="student">Your answer:</span><pre class="student-answer" data-sa="${i}"></pre>
             <span class="correct">Reference answer:</span><pre class="correct-answer" data-sa-correct="${i}"></pre></li>`
          ).join("")}
        </ul>` : ""}
        ${res.codingTestResponses?.length ? `<h3>Coding Test Results</h3>
        <ul class="short-answer-list">
          ${res.codingTestResponses.map((r, i) =>
            `<li>${r.sectionTitle ? `<em>${escapeHtml(r.sectionTitle)}</em><br/>` : ""}<strong>${escapeHtml(r.question)}</strong><br/>
             <span class="student">${escapeHtml(r.status)}</span><pre class="coding-answer" data-coding="${i}"></pre>
             ${r.output ? '<span>Run output:</span><pre class="coding-output" data-coding-output="' + i + '"></pre>' : ""}</li>`
          ).join("")}
        </ul>` : ""}
        ${res.likertResponses && res.likertResponses.length ? `
        <h3>Survey Responses:</h3>
        <ul class="short-answer-list">
          ${res.likertResponses.map(l =>
            `<li><strong>${l.question}</strong><br/><span class="student">Selected: ${l.label !== null ? l.label : '(no response)'}</span></li>`
          ).join("")}
        </ul>` : ''}
        <h3>Incorrect Answers:</h3>
        ${res.wrongAnswers.length === 0 ? "<p>All answers correct 🎉</p>" :
          `<ul class="wrong-list">
            ${res.wrongAnswers.map(w =>
              `<li><strong>${escapeHtml(w.type)}</strong> - ${escapeHtml(w.question)}<br/>
               <span class="student">Your answer: ${escapeHtml(w.student)}</span><br/>
               <span class="correct">Correct answer: ${escapeHtml(w.correct)}</span></li>`
            ).join("")}
           </ul>`}
          <p id="emailStatus" role="status" aria-live="polite">${escapeHtml(state.emailStatus || "Sending results by email…")}</p>
        <button id="logoutBtn" class="secondary">Log Out</button>
      </div>
    </div>
  `;

  res.shortAnswerResponses.forEach((r, i) => {
    app.querySelector(`pre[data-sa="${i}"]`).textContent = r.answer || "(no answer)";
    app.querySelector(`pre[data-sa-correct="${i}"]`).textContent = r.correctAnswer || "(no answer provided)";
  });

  (res.codingTestResponses || []).forEach((r, i) => {
    app.querySelector(`pre[data-coding="${i}"]`).textContent = r.code;
    if (r.output) app.querySelector(`pre[data-coding-output="${i}"]`).textContent = r.output;
  });

  qs("#logoutBtn").addEventListener("click", logout);
}
