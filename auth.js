async function initAuth() {
  // initAuth is now a no-op since users are loaded during login
  // when we know which course/term was selected
}

async function loadUsersForTerm(courseFolder, termFolder) {
  const userFolder = `${courseFolder}/${termFolder}`;
  const users = await loadJSON(`${userFolder}/users.json`);
  if (users) return users;
  return (await loadJSON(`${userFolder}/users.sample.json`)) || [];
}

// Find every (course, term) roster the given credentials appear in, then
// collapse to one entry per course, keeping the newest matching term
// (last entry in that course's termFolders array wins).
async function findCourseMatches(username, password) {
  const matchesByCourse = {};

  for (const courseFolder of Object.keys(COURSE_CONFIG)) {
    const { termFolders } = COURSE_CONFIG[courseFolder];
    for (const termFolder of termFolders) {
      const users = await loadUsersForTerm(courseFolder, termFolder);
      const account = users.find(x => x.username === username && x.password === password);
      if (account) {
        matchesByCourse[courseFolder] = { courseFolder, termFolder, account };
      }
    }
  }

  return Object.values(matchesByCourse);
}

// Registry of courses this portal serves. Edit these arrays to add/remove
// terms (rosters) or quizzes for a course.
//   termFolders  - subfolders searched for users.json / users.sample.json.
//                  Order oldest -> newest; if a login matches more than one
//                  term for the same course, the newest match wins.
//   quizFolders  - subfolders offered on the quiz-selection screen.
const COURSE_CONFIG = {
  Game1270: {
    label: "GAME 1270: Introduction to Game Design and Development",
    termFolders: ["Fall2025-03", "Fall2026"],
    quizFolders: [
      "Quiz1", "Quiz2", "Quiz3", "Quiz4",
      "Midterm", "Midterm_OpenBook", "Midterm_ClosedBook",
      "Final_OpenBook", "Final_ClosedBook",
    ],
  },
  Game1377: {
    label: "GAME 1377: Scripting for Game Developers",
    termFolders: ["Summer2026"],
    quizFolders: ["Survey 1", "Quiz1", "Midterm", "Modulo Quiz", "Review"],
  },
};

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
    selectCourse(matches[0]);
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
        </div>
      </div>
    </div>
  `;

  qsa(".course-option").forEach(btn => {
    btn.addEventListener("click", () => {
      selectCourse(matches[Number(btn.dataset.idx)]);
    });
  });
}

function selectCourse(match) {
  state.selectedCourse = match.courseFolder;
  state.selectedTerm = match.termFolder;
  renderQuizSelect(match);
}

function renderQuizSelect(match) {
  const quizFolders = COURSE_CONFIG[match.courseFolder].quizFolders;

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
}

function logout() {
  state.user = null;
  state.selectedCourse = null;
  state.selectedTerm = null;
  state.selectedQuizFolder = null;
  location.reload();
}
