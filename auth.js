async function initAuth() {
  // initAuth is now a no-op since users are loaded during login
  // when we know which course was selected
}

async function loadUsersForCourse(courseFolder) {
  const userFolder = `${courseFolder}/Fall2025-03`;
  try {
    state.users = await loadJSON(`${userFolder}/users.json`);
  } catch {
    state.users = await loadJSON(`${userFolder}/users.sample.json`);
  }
}
  
async function renderLogin() {
  const courses = ["Game1270", "Game1377"];
  const quizFolders = ["Quiz1", "Quiz2","Midterm_ClosedBook","Midterm_OpenBook", "Quiz3", "Quiz4", "Final_ClosedBook","Final_OpenBook"]; // Add available quiz folders here

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
            <button class="secondary" id="showHelp">Where do passwords come from?</button>
          </div>
          <div class="notice">No account? Ask your instructor.</div>
        </div>
      </div>
    </div>
  `;

  qs("#loginBtn").addEventListener("click", onLogin);
  qs("#showHelp").addEventListener("click", () => {
    alert("Get your password from your instructor.");
  });
}

function onLogin() {
  const u = qs("#username").value.trim();
  const p = qs("#password").value;
  const selectedCourse = qs("#courseDropdown").value; // Get selected course
  const selectedQuiz = qs("#quizDropdown").value; // Get selected quiz folder

  // Load users for the selected course first
  loadUsersForCourse(selectedCourse).then(() => {
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