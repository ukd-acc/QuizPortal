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

async function sendResultsByEmail(result) {
  if (!state.user) {
    console.error("No user logged in, cannot send email.");
    updateEmailStatus("Results could not be emailed: no user is signed in.");
    return;
  }
  if (!state.settings || !state.settings.emailConfig) {
    console.error("No email configuration found, cannot send email.");
    updateEmailStatus("Results could not be emailed: email is not configured.");
    return;
  }
  if (typeof emailjs === "undefined") {
    updateEmailStatus("Results were graded, but email is unavailable. Please notify your instructor.");
    return;
  }
  if (!Array.isArray(state.settings.emailRecipients) || state.settings.emailRecipients.length === 0) {
    updateEmailStatus("Results were graded, but no email recipient is configured.");
    return;
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
  
  try {
    await emailjs.send(
      state.settings.emailConfig.serviceID,
      state.settings.emailConfig.templateID,
      templateParams
    );
    updateEmailStatus("Results emailed successfully.");
  } catch (err) {
    console.error("❌ Email failed:", err);
    updateEmailStatus("Results were graded, but email failed. Please notify your instructor.");
  }
}

function updateEmailStatus(message) {
  state.emailStatus = message;
  const status = qs("#emailStatus");
  if (status) status.textContent = message;
}
