function shuffleArray(arr) {
  const a = [...arr]; // copy
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// app.js
async function initApp() {
  // Load initial settings from root (just for structure, will be overridden)
  state.settings = await loadJSON("settings.json");

  // init auth (users)
  await initAuth();

  initEmail();
  renderLogin();
  
}



async function initQuiz() {
  const courseFolder = state.selectedCourse; // Get the selected course folder (e.g., "Game1270")
  
  // Load course-specific settings from the course folder
  state.settings = await loadJSON(`${courseFolder}/settings.json`);
  
  if (!state.settings) {
    console.error(`Failed to load settings from ${courseFolder}/settings.json`);
    alert("Error: Could not load quiz settings. Please try again.");
    renderLogin();
    return;
  }
  
  state.quiz = { title: state.settings.title, sections: [] };

  const quizFolder = `${courseFolder}/${state.selectedQuizFolder}`; // Combine course folder with quiz folder

  // If the selected quiz folder has its own settings.json, prefer it (e.g., Survey 1)
  const quizLevelSettings = await loadJSON(`${quizFolder}/settings.json`);
  if (quizLevelSettings) {
    state.settings = quizLevelSettings;
  }

  for (const secMeta of state.settings.sections) {
    const sec = await loadJSON(`${quizFolder}/${secMeta.file}`);
    if (!sec) {
      console.warn(`Skipping section: ${secMeta.file} not found in ${quizFolder}`);
      continue; 
    }

    // Shuffle once here
    if (sec.type === "matching") {
      sec.prompts = shuffleArray(sec.prompts);
      sec.word_bank = shuffleArray(sec.word_bank);   
    }
    else if (sec.type === "true_false") {
      sec.questions = shuffleArray(sec.questions);
    }
    else if (sec.type === "multiple_choice") {
      sec.prompts = shuffleArray(sec.prompts);
      sec.prompts.forEach(q => {
        q.answers = shuffleArray(q.answers || q.answer); 
      });
    }
    else if (sec.type === "code_blocks_mc") {
      sec.prompts = shuffleArray(sec.prompts);
      sec.prompts.forEach(q => {
        q.answers = shuffleArray(q.answers || q.answer); 
      });
    }
    else if (sec.type === "matching_pictures") {
      sec.prompts = shuffleArray(sec.prompts);
      sec.word_bank = shuffleArray(sec.word_bank);
    }
    else if (sec.type === "fill_in_the_blank") {
      sec.questions = shuffleArray(sec.questions);
    }
    else if (sec.type === "code_blocks_fitb") {
      sec.questions = shuffleArray(sec.questions);
    }
    else if (sec.type === "fill_in_the_blank_list") {
      sec.questions = shuffleArray(sec.questions);
    }

    state.quiz.sections.push(sec);
  }

  renderQuiz();
}

function renderQuiz() {
  const app = qs("#app");
  app.innerHTML = `
    <!-- floating timer (independent of quiz card) -->
    <div id="timerContainer">
      <button id="toggleTimerBtn" class="secondary">Hide Timer</button>
      <div id="timer" class="timer">00:00</div>
    </div>

    <!-- floating table of contents -->
    <div id="tocContainer">
      <button id="toggleTocBtn" class="secondary">Hide TOC</button>
      <div id="toc" class="toc">
        <h3>Table of Contents</h3>
        <ul id="tocList"></ul>
      </div>
    </div>

    <div class="container">
      <div class="card">
        <h1>${state.quiz.title}</h1>
        <div id="sections"></div>
        <hr/>
        <button id="submitBtn">Submit Quiz</button>
      </div>
    </div>
  `;

  // Render sections
  const sectionsEl = qs("#sections");
  const tocListEl = qs("#tocList");
  state.quiz.sections.forEach((sec, idx) => {
    const sectionEl = document.createElement("div");
    sectionEl.id = `section-${idx}`;
    sectionEl.className = "quiz-section";
    sectionsEl.appendChild(sectionEl);

    // Attach section index for renderers that need unique keys/names
    sec._sectionIndex = idx;

    // Render section content
    if (sec.type === "matching") sectionEl.appendChild(renderMatchingSection(sec));
    if (sec.type === "true_false") sectionEl.appendChild(renderTFSection(sec));
    if (sec.type === "matching_pictures") sectionEl.appendChild(renderMatchingPicturesSection(sec));
    if (sec.type === "multiple_choice") sectionEl.appendChild(renderMCSection(sec));
    if (sec.type === "likert") sectionEl.appendChild(renderLikertSection(sec));
    if (sec.type === "code_blocks_mc") sectionEl.appendChild(renderCodeBlocksMCSection(sec));
    if (sec.type === "fill_in_the_blank") sectionEl.appendChild(renderFillInTheBlankSection(sec));
    if (sec.type === "code_blocks_fitb") sectionEl.appendChild(renderCodeBlocksFITBSection(sec));
    if (sec.type === "fill_in_the_blank_list") sectionEl.appendChild(renderFillInTheBlankListSection(sec));
    if (sec.type === "short_answer") sectionEl.appendChild(renderShortAnswerSection(sec));
    if (sec.type === "coding_test") sectionEl.appendChild(renderCodingTestSection(sec));

    // Add section to TOC
    const tocItem = document.createElement("li");
    tocItem.innerHTML = `<a href="#section-${idx}">${sec.title}</a>`;
    tocListEl.appendChild(tocItem);
  });

  // Timer logic
  state.startTime = new Date();
  startTimer();

  qs("#toggleTimerBtn").addEventListener("click", () => {
    const timerEl = qs("#timer");
    if (timerEl.style.display === "none") {
      timerEl.style.display = "block";
      qs("#toggleTimerBtn").textContent = "Hide Timer";
    } else {
      timerEl.style.display = "none";
      qs("#toggleTimerBtn").textContent = "Show Timer";
    }
  });

  // TOC toggle logic
  qs("#toggleTocBtn").addEventListener("click", () => {
    const tocEl = qs("#toc");
    if (tocEl.style.display === "none") {
      tocEl.style.display = "block";
      qs("#toggleTocBtn").textContent = "Hide TOC";
    } else {
      tocEl.style.display = "none";
      qs("#toggleTocBtn").textContent = "Show TOC";
    }
  });

  qs("#submitBtn").addEventListener("click", onSubmit);
}

function startTimer() {
  const timerEl = qs("#timer");
  function update() {
    const now = new Date();
    const elapsed = Math.floor((now - state.startTime) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    timerEl.textContent = `${minutes}:${seconds}`;
  }
  update();
  state.timerInterval = setInterval(update, 1000);
}

function onSubmit() {
  state.endTime = new Date();
  const res = gradeQuiz();
  showSummary(res);
  sendResultsByEmail(res);
}

window.addEventListener("DOMContentLoaded", initApp);