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

Each `NN_*.js` file is one check: it prints `PASS …` / `FAIL …` lines and exits non-zero on a failure. Screenshots go to `out/`. The checks use `data/mcqs.csv` (36 questions in 3 decks) and block all network access, so they behave the same offline.

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
