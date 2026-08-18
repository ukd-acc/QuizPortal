// Global state object shared across files.
// Think of this as a "GameState" struct in C++.
const state = {
    user: null,       // logged-in user object
    quiz: null,       // full quiz data (title, sections, etc.)
    answers: {},      // dictionary of answers { "matching-1": "A", "tf-2": true }
    startTime: null,  // Date object when quiz started
    endTime: null,    // Date object when quiz ended
    settings: null,   // loaded from settings.json
    selectedCourse: null, // selected course (e.g., "Game1270" or "Game1377")
    selectedTerm: null, // roster/term folder the logged-in account matched (e.g., "Fall2026")
    selectedQuizFolder: null // folder for the selected quiz
};

