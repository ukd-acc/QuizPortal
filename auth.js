async function initAuth() {
  // initAuth is now a no-op since users are loaded during login
  // when we know which course was selected
}

async function loadUsersForCourse(courseFolder) {
  const userFolder = `${courseFolder}/${state.settings.userFolder}`;
  try {
    state.users = await loadJSON(`${userFolder}/users.json`);
  } catch {
    state.users = await loadJSON(`${userFolder}/users.sample.json`);
  }
}
  
async function renderLogin() {
  const courses = ["Game1377"];
  const quizFolders = ["Review", "Survey 1", "Modulo Quiz"]; // Add available quiz folders here

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
            <label>Select Course</label>
            <select id="courseDropdown">
              ${courses.map(course => `<option value="${course}">${course}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Select Quiz</label>
            <select id="quizDropdown">
              ${quizFolders.map(folder => `<option value="${folder}">${folder}</option>`).join("")}
            </select>
          </div>
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

function onLogin() {
  const u = qs("#username").value.trim();
  const p = qs("#password").value;
  const selectedCourse = qs("#courseDropdown").value; // Get selected course
  const selectedQuiz = qs("#quizDropdown").value; // Get selected quiz folder

  // Load course-specific settings first, then load users
  loadJSON(`${selectedCourse}/settings.json`).then(courseSettings => {
    state.settings = courseSettings;
    return loadUsersForCourse(selectedCourse);
  }).then(() => {
    const account = state.users.find(x => x.username === u && x.password === p);

    if (!account) {
      alert("Invalid username or password.");
      return;
    }

    state.user = { username: account.username, fullName: account.fullName || account.username };
    state.selectedCourse = selectedCourse; // Save selected course in state
    state.selectedQuizFolder = selectedQuiz; // Save selected quiz folder in state
    initQuiz(); 
  });
}
  
function logout() {
  state.user = null;
  location.reload();
}