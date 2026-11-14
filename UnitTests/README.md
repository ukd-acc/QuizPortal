# Quiz Portal Unit Tests

The unit suite runs in a browser against the same global JavaScript files and DOM APIs used by the app. It has no package installation step.

1. Start the repository's `Start Python Server` task, or run `python -m http.server 8000` from the repository root.
2. Open `http://localhost:8000/UnitTests/`.
3. Wait for the result summary. Any failures are listed with the test name and stack trace.

The data smoke test crawls the three course folders, loads every quiz-level `settings.json`, parses each referenced section file (including the app's supported JSON comments), and runs the loaded sections through grading with unanswered inputs. A second data test opens every quiz through the real renderers, answers it, submits it, and checks for one mocked email. The Game1270 Closed Book tests load the actual quiz, answer its rendered controls, and submit it. `closed-book.tests.js` covers all-correct, all-incorrect, blank, whitespace-only, partial, duplicate, near-miss, hostile and unusual-character answers, seeded random mixes, double submission, the deadline, email failures, and accommodations. Other tests exercise all renderers, grading paths, timer/submission behavior, auth term selection, and email payload generation.

The regular suite never sends email. To send one real integration message, click **Send One Real Midterm Test Email** and confirm the status reports success. It submits a deliberately all-incorrect test attempt for Game1270 Midterm Closed Book to the single recipient configured in `Game1270/settings.json`; the email uses the real EmailJS SDK and has a 30-second test timeout. Do not click it during routine test runs.