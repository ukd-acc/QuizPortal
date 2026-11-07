// email.js
function initEmail() {
  if (!state.settings || !state.settings.emailConfig) {
    console.warn("⚠️ Email configuration missing in settings.json");
    return;
  }
  emailjs.init(state.settings.emailConfig.publicKey);
}

const EMAIL_TIMEOUT_MS = 30000;

function reportEmailFailure(error) {
  console.error("❌ Email failed:", error);
  alert("Error sending email. Please keep this page open and notify your instructor.");
  return { sent: false, error };
}

// Always resolves to { sent, error? } and never throws, so a caller cannot be
// interrupted by an email problem and the student always hears about a failure.
function sendResultsByEmail(result, timeoutMs = EMAIL_TIMEOUT_MS) {
  try {
    return deliverResults(result, timeoutMs).catch(reportEmailFailure);
  } catch (error) {
    return Promise.resolve(reportEmailFailure(error));
  }
}

function deliverResults(result, timeoutMs) {
  if (!state.user) {
    throw new Error("No user logged in, cannot send email.");
  }
  if (!state.settings || !state.settings.emailConfig) {
    throw new Error("No email configuration found, cannot send email.");
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
        `Short answers:\n${shortAnswerDetails}\n\n` +
        `Survey responses:\n${likertDetails}`

  };
  
  let timeoutId;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`No email response after ${timeoutMs / 1000} seconds.`)), timeoutMs);
  });

  return Promise.race([
    emailjs.send(
      state.settings.emailConfig.serviceID,
      state.settings.emailConfig.templateID,
      templateParams
    ),
    timeout
  ])
  .then(() => {
    alert("✅ Results emailed successfully!");
    return { sent: true };
  })
  .finally(() => clearTimeout(timeoutId));
}
