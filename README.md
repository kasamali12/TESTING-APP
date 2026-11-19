# Checks

End-to-end checks that open `index.html` in Chromium and use it like a student would: import questions, take quizzes and tests, change settings, back up and restore, switch themes.

```
cd tests
npm install
npx playwright install chromium     # once
npm test                            # all checks (about 10 minutes)
node run.js 04 12                   # only checks starting with 04 or 12
APP=/path/to/other.html npm test    # another build
```

Each `NN_*.js` file is one check: it prints `PASS …` / `FAIL …` lines and exits non-zero on a failure. Screenshots go to `out/`. The checks use `data/mcqs.csv` (36 questions in 3 decks), `data/multi_subject.csv` (252 questions, 4 subjects, 20 chapters), `data/subject_mix.csv` (152 mixed questions without subject folders, with the right subject of each in `subject_mix.labels.json`) and `data/general_quiz.csv` (30 non-medical questions), and block all network access, so they behave the same offline.

GitHub runs them on every push and pull request before the page is published (see `.github/workflows/pages.yml`).

| File | What it covers |
|---|---|
| 01–03 | Home, library, quiz, results, Browse, retry wrong answers |
| 04–05, 12 | Custom tests, NEET PG mock, saved tests and test detail |
| 06–11 | Quiz options, scoring (+4 / −1), flashcards, starred, weak areas, daily plan, search, settings, edit / delete |
| 13–14 | Fast taps on answers, local dates and streaks |
| 15 | CSV import and export, multi-line explanations, answer keys |
| 16–18 | Backup and restore, accessibility, true-black (AMOLED) theme |
| 19–20 | TriPath: layout and theme inside the app, first-run screen |
| 21 | Exam screen layout (phone and sideways), NEET instructions, Settings rows, Undo and notices after a quiz, first-run Home, honest score projection |
| 22 | Accounts against a fake database: hashed passwords, upgrade of old ones, recovery, no overwrite after a failed download |
| 23 | One NEET subject split, Half and Full mock sizes, honest labels, the Home reviews-due chip |
| 24 | The set-up tools (database address, admin password) on the built page |
| 25 | Dialogs scroll: the Export Deck dialog fits and scrolls on five screen sizes, and none of the app's 33 dialogs is cut off by the screen edge |
| 26 | Mock tests and Custom Test cover every chapter and prefer unseen questions; shortfall top-up; fair shuffle; folder-name matching; auto-sort of imports (accuracy, Subject column, structured file untouched, non-medical and tiny files untouched, Settings switch, Sort by subject on an existing deck) |
| 27 | The card after an answer: verdict with the right option's letter, regular-weight explanation with bold headings, result scrolled into view, four even navigation buttons (five screen sizes) |
| 28 | Uploaded files keep their folder tree: nested HTML banks by both import routes (18 of 18 questions, four levels deep, number and text answers, trailing comma, flat file); Anki decks (no empty "Default", flat deck sorted, tags become folders, switch off leaves it alone). Anki side uses a stand-in for sql.js (`apkg_fake.js`) |
| 29 | Leaderboard against a fake Firebase (`fakefb.js`): consent first, own row only, no contact details sent, ranking by period, test kind and metric, ties, hidden impossible rows, script-looking names as text, sync after a quiz, nothing sent if not joined, errors, admin list, search, CSV, remove and clear, a new device never shrinks a row, layout on three screens |
| 30 | `firebase/database.rules.json` run in a stand-in rules engine (`rules_eval.js`): accepts the row the app really writes, refuses 19 kinds of impossible row, keeps the sign-up list and payment settings rules as they were |
| 31 | Sepia tone and labels: the answered card is warm brown in dark and true black (contrast ≥ 7 / ≥ 4.5), light theme untouched, answer colours unchanged, Settings switch saved across reload and restored by Reset appearance; the HTML import button, screen title and drop zone no longer say "Marrow" and only the disclaimers and the TriPath planner still do |
