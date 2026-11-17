// email.js
function initEmail() {
  if (!state.settings || !state.settings.emailConfig) {
    console.warn("⚠️ Email configuration missing in settings.json");
    return false;
  }
  if (typeof emailjs === "undefined") {
    console.error("EmailJS SDK is unavailable; quiz submission will continue without email.");
    return false;
  }
  try {
    emailjs.init(state.settings.emailConfig.publicKey);
    return true;
  } catch (error) {
    console.error("EmailJS initialization failed; quiz submission will continue without email.", error);
    return false;
  }
}

const EMAIL_TIMEOUT_MS = 30000;
const EMAIL_FAILED_MESSAGE = "Results were graded, but email failed. Please keep this page open and notify your instructor.";

function emailSetupError(studentMessage) {
  const error = new Error(studentMessage);
  error.studentMessage = studentMessage;
  return error;
}

// A failed email needs the student to act, so it is shown on the page and as a popup.
function reportEmailFailure(error) {
  console.error("❌ Email failed:", error);
  const message = error?.studentMessage || EMAIL_FAILED_MESSAGE;
  updateEmailStatus(message, "failed");
  alert(message);
  return { sent: false, error };
}

// Always resolves to { sent: true } or { sent: false, error } and never throws, so an
// email problem cannot interrupt a submission. A request with no reply within
// timeoutMs counts as failed, so the student is never left waiting on "Sending…".
function sendResultsByEmail(result, timeoutMs = EMAIL_TIMEOUT_MS) {
  let request;
  try {
    request = Promise.resolve(startEmailRequest(result));
  } catch (error) {
    return Promise.resolve(reportEmailFailure(error));
  }

  let timeoutId;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`No email response after ${timeoutMs / 1000} seconds.`)), timeoutMs);
  });

  return Promise.race([request, timeout])
    .then(() => {
      updateEmailStatus("Results emailed successfully.", "sent");
      return { sent: true };
    }, reportEmailFailure)
    .finally(() => clearTimeout(timeoutId));
}

// Builds the message and starts the EmailJS request; throws if email cannot be sent.
function startEmailRequest(result) {
  if (!state.user) {
    throw emailSetupError("Results were graded, but could not be emailed because no user is signed in. Please notify your instructor.");
  }
  if (!state.settings || !state.settings.emailConfig) {
    throw emailSetupError("Results were graded, but email is not configured. Please notify your instructor.");
  }
  if (typeof emailjs === "undefined") {
    throw emailSetupError("Results were graded, but email is unavailable. Please keep this page open and notify your instructor.");
  }
  if (!Array.isArray(state.settings.emailRecipients) || state.settings.emailRecipients.length === 0) {
    throw emailSetupError("Results were graded, but no email recipient is configured. Please notify your instructor.");
  }

  const durationMs = state.endTime - state.startTime;
  const durationMin = Math.round(durationMs / 60000);
  const courseTitle = state.courseTitle || state.selectedCourse;
  const quizTitle = state.selectedQuizFolder || state.quiz.title || state.settings.title;
  const studentName = state.user.fullName || state.user.username;
  const shortAnswerOnly = state.quiz.sections.length > 0 &&
    state.quiz.sections.every(section => section.type === "short_answer");

  // 🔹 Build wrong answers section
  let wrongDetails = "All answers correct 🎉";
  if (result.wrongAnswers.length > 0) {
    wrongDetails = result.wrongAnswers.map(w =>
      `${w.type}: ${w.question}\n  Student: ${w.student}\n  Correct: ${w.correct}`
    ).join("\n\n");
  }
  let shortAnswerDetails = "No short answers";
  if(result.shortAnswerResponses.length > 0) {
    shortAnswerDetails = result.shortAnswerResponses.map(r => 
      `${r.question}:\nStudent: ${r.answer || "(no answer)"}${shortAnswerOnly ? "" : `\nReference answer: ${r.correctAnswer || "(no answer provided)"}`}`
    ).join("\n\n");
  }
  let likertDetails = "No survey responses";
  if (result.likertResponses && result.likertResponses.length > 0) {
    likertDetails = result.likertResponses.map(l =>
      `${l.question}: ${l.label !== null ? l.label : '(no response)'} (${l.value !== null ? l.value : 'n/a'})`
    ).join("\n");
  }
  const codingTestDetails = result.codingTestResponses?.length
    ? result.codingTestResponses.map(response =>
      `${response.sectionTitle}: ${response.status}\nProblem: ${response.question}\nCode:\n${response.code}\nOutput:\n${response.output || "(no output)"}`
    ).join("\n\n")
    : "No coding-test responses";
  const templateParams = {
    to_email: state.settings.emailRecipients.join(", "),
    name: state.user.fullName || state.user.username,
    title: `${courseTitle} - ${quizTitle}`,
    time: new Date().toLocaleString(),
    message: shortAnswerOnly
      ? `Course: ${courseTitle}\nQuiz/Exam: ${quizTitle}\n\n${studentName}'s responses:\n\n${shortAnswerDetails}`
      : `Course: ${courseTitle}\nQuiz/Exam: ${quizTitle}\n\nResults for ${studentName}:\n\n` +
        `Score: ${result.points}/${result.total} (${result.percent}%).\n` +
        `Duration: ${durationMin} minute${durationMin !== 1 ? "s" : ""}.\n\n` +
        `Incorrect answers:\n${wrongDetails}\n` +
        `Short answers (instructor review; not auto-scored):\n${shortAnswerDetails}\n\n` +
        `Coding tests:\n${codingTestDetails}\n\n` +
        `Survey responses:\n${likertDetails}`

  };
  
  return emailjs.send(
    state.settings.emailConfig.serviceID,
    state.settings.emailConfig.templateID,
    templateParams
  );
}

// outcome is "sending", "sent" or "failed"; the summary page styles the line by it.
function updateEmailStatus(message, outcome = "sending") {
  state.emailStatus = message;
  state.emailOutcome = outcome;
  const status = qs("#emailStatus");
  if (status) {
    status.textContent = message;
    status.dataset.outcome = outcome;
  }
}
