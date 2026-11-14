function loadEmailJsSdk() {
  if (globalThis.emailjs?.send) return Promise.resolve(globalThis.emailjs);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeoutId = setTimeout(() => {
      script.remove();
      reject(new Error("Timed out loading the EmailJS SDK."));
    }, 15000);
    script.src = "https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js";
    script.onload = () => {
      clearTimeout(timeoutId);
      if (globalThis.emailjs?.send) resolve(globalThis.emailjs);
      else reject(new Error("The EmailJS SDK loaded without its send API."));
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Could not load the EmailJS SDK."));
    };
    document.head.appendChild(script);
  });
}

async function sendLiveMidtermEmail() {
  const button = document.querySelector("#live-email-button");
  const status = document.querySelector("#live-email-status");
  const originalAlert = globalThis.alert;
  const originalEmailJS = globalThis.emailjs;
  const originalSendResults = globalThis.sendResultsByEmail;
  let sendPromise;
  let timeoutId;

  button.disabled = true;
  status.textContent = "Preparing the rendered midterm and live email...";

  try {
    const settingsResponse = await fetch("/Game1270/settings.json");
    if (!settingsResponse.ok) throw new Error("Could not load Game1270 email settings.");
    const courseSettings = JSON.parse(stripJsonComments(await settingsResponse.text()));
    const recipients = courseSettings.emailRecipients || [];
    if (recipients.length !== 1 || recipients[0] !== "utsab.das@austincc.edu") {
      throw new Error(`Expected only utsab.das@austincc.edu as recipient; found ${recipients.join(", ") || "none"}.`);
    }

    const sdk = await loadEmailJsSdk();
    await openRenderedClosedBookMidterm(false);
    globalThis.alert = () => {};
    globalThis.sendResultsByEmail = function (result) {
      sendPromise = originalSendResults(result);
      return sendPromise;
    };
    state.user.fullName = "AUTOMATED TEST - GAME 1270 MIDTERM CLOSED BOOK";
    answerRenderedClosedBookMidterm(false);
    document.querySelector("#submitBtn").click();

    assert(state.submitted, "the rendered exam did not submit");
    assert(document.querySelector("#app").textContent.includes("You scored 0/100"), "the test attempt did not produce the expected 0/100 score");
    assert(sendPromise, "submission did not call the live EmailJS send API");

    const outcome = await Promise.race([
      sendPromise,
      new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error("EmailJS did not respond within 30 seconds.")), 30000);
      })
    ]);
    if (!outcome?.sent) throw new Error(`EmailJS send failed: ${outcome?.error?.message || "unknown error"}`);
    status.textContent = `EmailJS accepted the full 0/100 test submission for ${recipients[0]}.`;
  } catch (error) {
    status.textContent = `Live email test failed: ${error.message}`;
  } finally {
    clearTimeout(timeoutId);
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.sendResultsByEmail = originalSendResults;
    globalThis.emailjs = originalEmailJS;
    globalThis.alert = originalAlert;
    button.disabled = false;
  }
}

document.querySelector("#live-email-button").addEventListener("click", sendLiveMidtermEmail);

test("live email test builds a full payload without sending real email", async () => {
  const previousEmailJS = globalThis.emailjs;
  const sentMessages = [];
  globalThis.emailjs = {
    init() {},
    send: (...args) => {
      sentMessages.push(args);
      return Promise.resolve({ status: 200 });
    }
  };

  try {
    await sendLiveMidtermEmail();
    assertEqual(sentMessages.length, 1, "mock email sends");
    const [serviceId, templateId, params] = sentMessages[0];
    assert(serviceId && templateId, "service or template id missing");
    assertEqual(params.to_email, "utsab.das@austincc.edu", "live-test recipient");
    assert(params.message.includes("AUTOMATED TEST - GAME 1270 MIDTERM CLOSED BOOK"), "test identity missing from email");
    assert(params.message.includes("Score: 0/100 (0%)."), "score missing from email");
    assert(params.message.includes("Incorrect answers:"), "full incorrect-answer output missing from email");
    assert(document.querySelector("#live-email-status").textContent.startsWith("EmailJS accepted"), "live test status did not report success");
  } finally {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    globalThis.emailjs = previousEmailJS;
  }
});