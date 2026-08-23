async function initAuth() {
  const courseFolders = state.settings.courseFolders || [];
  const courseSettings = await Promise.all(courseFolders.map(async courseFolder => ({
    courseFolder,
    settings: await loadJSON(`${courseFolder}/settings.json`)
  })));

  COURSE_CONFIG = Object.fromEntries(
    courseSettings
      .filter(({ settings }) => settings)
      .map(({ courseFolder, settings }) => [courseFolder, {
        label: settings.label || settings.title,
        termFolders: settings.termFolders || []
      }])
  );
}

async function loadUsersForTerm(courseFolder, termFolder) {
  const userFolder = `${courseFolder}/${termFolder}`;
  const users = await loadJSON(`${userFolder}/users.json`);
  if (users) return users;
  return (await loadJSON(`${userFolder}/users.sample.json`)) || [];
}

// Find every (course, term) roster the given credentials appear in, then
// keep the newest matching term separately for each course. Each term's
// settings.json supplies the active quizzes for that class.
async function findCourseMatches(username, password) {
  const matchesByCourse = {};

  for (const courseFolder of Object.keys(COURSE_CONFIG)) {
    const { termFolders } = COURSE_CONFIG[courseFolder];
    for (const termFolder of termFolders) {
      const users = await loadUsersForTerm(courseFolder, termFolder);
      const account = users.find(x => x.username === username && x.password === password);
      if (account) {
        const classSettings = await loadJSON(`${courseFolder}/${termFolder}/settings.json`);
        const match = { courseFolder, termFolder, account, classSettings };
        const existingMatch = matchesByCourse[courseFolder];
        const startDate = Date.parse(classSettings?.startDate || "") || 0;
        const existingStartDate = Date.parse(existingMatch?.classSettings?.startDate || "") || 0;

        if (!existingMatch || startDate >= existingStartDate) {
          matchesByCourse[courseFolder] = match;
        }
      }
    }
  }

  return Object.values(matchesByCourse);
}

// Populated from each course's settings.json during initialization.
let COURSE_CONFIG = {};

async function renderLogin() {
  qs("#app").innerHTML = `
    <div class="container login">
      <div class="card">
        <div class="header">
          <div>
            <div class="logo">Quiz Portal</div>
            <div class="notice">Sign in with your assigned username and password.</div>
          </div>
          <span class="badge">Client-side demo auth</span>
        </div>
        <div class="row">
          <div>
            <label>Username</label>
            <input id="username" placeholder="e.g. alice" autocomplete="username"/>
          </div>
          <div>
            <label>Password</label>
            <input id="password" type="password" placeholder="Your password" autocomplete="current-password"/>
          </div>
        </div>
        <div class="login-actions">
          <div class="flex">
            <button id="loginBtn">Sign In</button>
          </div>
          <div class="notice">No account or password? Ask your instructor.</div>
        </div>
      </div>
    </div>
  `;

  qs("#loginBtn").addEventListener("click", onLogin);

  // Add Enter key listener to username and password fields
  qs("#username").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const u = qs("#username").value.trim();
      const p = qs("#password").value;
      if (u && p) {
        onLogin();
      }
    }
  });

  qs("#password").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const u = qs("#username").value.trim();
      const p = qs("#password").value;
      if (u && p) {
        onLogin();
      }
    }
  });

  // Add input listeners to enable/disable login button
  const usernameInput = qs("#username");
  const passwordInput = qs("#password");
  const loginBtn = qs("#loginBtn");

  // Initial button state
  updateLoginButtonState();

  usernameInput.addEventListener("input", updateLoginButtonState);
  passwordInput.addEventListener("input", updateLoginButtonState);

  function updateLoginButtonState() {
    const u = usernameInput.value.trim();
    const p = passwordInput.value;

    if (u && p) {
      loginBtn.disabled = false;
      loginBtn.classList.add("enabled");
      loginBtn.classList.remove("disabled");
    } else {
      loginBtn.disabled = true;
      loginBtn.classList.add("disabled");
      loginBtn.classList.remove("enabled");
    }
  }
}

async function onLogin() {
  const u = qs("#username").value.trim();
  const p = qs("#password").value;

  const loginBtn = qs("#loginBtn");
  loginBtn.disabled = true;

  const matches = await findCourseMatches(u, p);

  if (matches.length === 0) {
    alert("Invalid username or password.");
    loginBtn.disabled = false;
    return;
  }

  state.user = { username: matches[0].account.username, fullName: matches[0].account.fullName || matches[0].account.username };

  if (matches.length === 1) {
    selectCourse(matches[0], matches);
  } else {
    renderCourseSelect(matches);
  }
}

function renderCourseSelect(matches) {
  qs("#app").innerHTML = `
    <div class="container login">
      <div class="card">
        <div class="header">
          <div>
            <div class="logo">Select a Course</div>
            <div class="notice">Welcome, ${state.user.fullName}. You're enrolled in more than one course.</div>
          </div>
        </div>
        <div class="login-actions" style="flex-direction:column; align-items:stretch; gap:8px;">
          ${matches.map((m, idx) => `
            <button class="secondary course-option" data-idx="${idx}">
              ${COURSE_CONFIG[m.courseFolder].label}
            </button>
          `).join("")}
          <button id="backToLoginBtn" class="secondary">Logout</button>
        </div>
      </div>
    </div>
  `;

  qsa(".course-option").forEach(btn => {
    btn.addEventListener("click", () => {
      selectCourse(matches[Number(btn.dataset.idx)], matches);
    });
  });

  qs("#backToLoginBtn").addEventListener("click", returnToLogin);
}

function selectCourse(match, matches) {
  state.selectedCourse = match.courseFolder;
  state.selectedTerm = match.termFolder;
  renderQuizSelect(match, matches);
}

function renderQuizSelect(match, matches) {
  const quizFolders = match.classSettings?.activeQuizzes || [];

  qs("#app").innerHTML = `
    <div class="container login">
      <div class="card">
        <div class="header">
          <div>
            <div class="logo">${COURSE_CONFIG[match.courseFolder].label}</div>
            <div class="notice">Select a quiz to begin.</div>
          </div>
        </div>
        <div class="login-actions" style="flex-direction:column; align-items:stretch; gap:8px;">
          ${quizFolders.map((folder, idx) => `
            <button class="secondary quiz-option" data-idx="${idx}">${folder}</button>
          `).join("")}
          <button id="backFromQuizSelectBtn" class="secondary">Back</button>
        </div>
      </div>
    </div>
  `;

  qsa(".quiz-option").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedQuizFolder = quizFolders[Number(btn.dataset.idx)];
      initQuiz();
    });
  });

  qs("#backFromQuizSelectBtn").addEventListener("click", () => {
    if (matches && matches.length > 1) {
      renderCourseSelect(matches);
    } else {
      returnToLogin();
    }
  });
}

function returnToLogin() {
  state.user = null;
  state.selectedCourse = null;
  state.selectedTerm = null;
  state.selectedQuizFolder = null;
  renderLogin();
}

function logout() {
  state.user = null;
  state.selectedCourse = null;
  state.selectedTerm = null;
  state.selectedQuizFolder = null;
  location.reload();
}
