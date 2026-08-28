// email.js
function initEmail() {
  if (!state.settings || !state.settings.emailConfig) {
    console.warn("⚠️ Email configuration missing in settings.json");
    return;
  }
  emailjs.init(state.settings.emailConfig.publicKey);
}

function sendResultsByEmail(result) {
  if (!state.user) {
    console.error("No user logged in, cannot send email.");
    return;
  }
  if (!state.settings || !state.settings.emailConfig) {
    console.error("No email configuration found, cannot send email.");
    return;
  }

  const durationMs = state.endTime - state.startTime;
  const durationMin = Math.round(durationMs / 60000);

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
      `${r.sectionTitle ? `[${r.sectionTitle}] ` : ""}${r.question}:\nStudent: ${r.answer || "(no answer)"}\nReference answer: ${r.correctAnswer || "(no answer provided)"}`
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
    title: state.settings.title,
    time: new Date().toLocaleString(),
    message:
      `${state.settings.title} results for ${state.user.fullName}:\n\n` +
      `Score: ${result.points}/${result.total} (${result.percent}%).\n` +
      `Duration: ${durationMin} minute${durationMin !== 1 ? "s" : ""}.\n\n` +
  `Incorrect answers:\n${wrongDetails}\n` +
  `Short answers:\n${shortAnswerDetails}\n\n` +
  `Survey responses:\n${likertDetails}`

  };
  
  emailjs.send(
    state.settings.emailConfig.serviceID,
    state.settings.emailConfig.templateID,
    templateParams
  )
  .then(() => {
    alert("✅ Results emailed successfully!")
//    logout();
  })
  .catch(err => {
    console.error("❌ Email failed:", err);
    alert("Error sending email. Please notify your instructor.");
  });
}
