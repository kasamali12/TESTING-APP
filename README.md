# StudyDeck Pro

NEET PG / INI-CET study app in a single self-contained page: decks, MCQ practice, tests, analytics, flashcards and TriPath. It runs fully in the browser and keeps your data on your device.

## Put it on GitHub Pages

1. Create a repository and upload everything in this folder (keep the folder structure, including `.github/` and `.nojekyll`).
2. In the repository open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The **Deploy StudyDeck to GitHub Pages** workflow publishes the site. Its address is `https://<your-name>.github.io/<repository>/`.

Open that address on your phone or laptop, then use **Install app** (browser menu, or Settings → App & Offline). After the first visit the app opens without internet.

### Before you make the repository public

**The sign-up list is open to anyone who has the page address.** The page talks to Firebase without any sign-in, so whoever reads the page source can read the sign-up list (names, mobile numbers, emails, passkeys, password hashes) and can edit it, for example mark their own account approved or change the UPI ID shown to new students. This version no longer stores passwords in readable form and never overwrites the accounts after a failed download, and `firebase/SETUP.md` shows how to use a project of your own with locked-down rules. Only moving sign-in to Firebase Authentication closes the list properly; the last section of that guide explains what that involves. Use a Firebase project that holds nothing else.

The administrator password is no longer stored as plain text in `index.html`: only a salted PBKDF2-SHA256 hash is. The same password still signs in. Two limits remain, because the whole check runs in the visitor's browser:

- The administrator email, the Firebase address (`SDA_CONF`) and the hash are readable by anyone who opens the page, and a determined person can skip a browser-only check. For real protection, use Firebase Authentication and security rules that only allow the admin to read all users.
- If an earlier copy of `index.html` with the plain password was ever pushed to GitHub, it stays in the repository history. Change the password (below) and treat the old one as public.

Change the administrator password any time:

```
python3 tools/set_admin_password.py index.html
```

Type the new password twice (at least 10 characters), then commit and push the changed `index.html`.

## What is in this folder

| File | Purpose |
| --- | --- |
| `index.html` | The whole app (under 2 MB). It also opens on its own from a local file. |
| `manifest.webmanifest` | Name, colours and icons so the app can be installed. |
| `sw.js` | Service worker: offline use and update notices. |
| `icons/` | App icons (192, 512 and a maskable 512). |
| `.github/workflows/pages.yml` | Deploys the site and stamps a build id into `sw.js`. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |
| `firebase/` | `SETUP.md` (step by step, and what the rules do and do not protect) and `database.rules.json` for the Firebase Realtime Database (sign-up list, payment settings and the leaderboard). |
| `tools/` | Optional helper scripts: change the admin password, point the app at your own Firebase database, put a new TriPath in, split and rebuild `index.html`. |
| `dev/layers/` | Readable sources of the layout, enhancement and admin-check code that was added to the app (the single page holds them minified). |
| `tests/` | End-to-end checks (Playwright). GitHub runs them before every publish; see `tests/README.md`. |

## Updates

Every push to `main` gets a new build id. Visitors see **A new version is ready** and tap **Update**; nothing is lost because progress is saved in the browser. Page loads also try the network first, so a hosted copy refreshes quickly when online.

## Your data

Decks and progress live in this browser (IndexedDB and local storage), not on GitHub. Clearing site data, switching browser or switching device starts empty. Use **Tools → Backup** (or Settings → App & Offline → **Back up now**) to export; it saves one `.sdpack` file (see below). Home reminds you when your last full backup is more than 14 days old, or when you have decks and have never backed up. Settings → App & Offline → **Keep data safe** asks the browser not to clear your data automatically.

### StudyDeck Pack (`.sdpack`): small, quick, one-tap import

Export → **StudyDeck Pack** saves one deck; Settings → **Back up now** (or Export → **All decks + progress**) saves every deck together with scores, stars, sessions, difficulty marks, test results and the spaced-repetition data, XP and NEET category. To restore, choose the file in Home → Import (the name does not matter: a pack renamed to `.zip` is still recognised). Decks that are already on the device are never overwritten: a same-named deck is added as "(2)", and in a full backup a deck that is already here is kept as it is.

A pack is an ordinary ZIP file that any unzip tool opens: `manifest.json` (decks, folder trees, counts), `q/<n>.json` (questions, about 700 KB of text per piece, deflate-compressed), `i/<n>` (each picture or audio file once, as raw bytes instead of base64 text, so a picture used on many questions is stored once) and `meta.json` (progress). On a 3,000-question test deck with 375 pictures the pack was 10.8 MB against 15.5 MB as JSON; a text-only deck went from 2.1 MB to 0.32 MB.

Battery and speed: packing reads the library a page at a time, uses the browser's own compression, hands the screen back every 30 ms (no freeze) and leaves no timer running. Import reads the file's table of contents first and then one piece at a time. Every piece is checked (size and checksum) and the import is undone if anything is wrong, so a cut-off or damaged file says so in plain words and never leaves half a deck behind. Nothing private goes into a pack: no login, PIN, leaderboard name or admin data. Where the browser can share files (most phones) a **Share** button sends the pack to another device. Browsers without compression support still write a valid pack (stored, not compressed).

The old full-backup `.json` files made by earlier versions (they could not be read back before) are restored too, and the deck-only JSON export is still there as "Large file". ZIPs that are not StudyDeck packs now get a clear message (the old ZIP import called code that did not exist, so it always failed).

**Exports over 48 MB are split into connected files.** Any export (StudyDeck Pack, JSON, HTML study sheet, Excel, backups) whose file would be bigger than 48 MB (48,000,000 bytes) is not downloaded by itself; a "Connected files" panel opens with a **Save** button for every part, **Save all** and, where the phone can share files, **Share**. Each part is at most 48,000,000 bytes, is named `<name>_part1of3.sdpack` (so the file picker still accepts it) and begins with a short text label (`SDPART1 ` + JSON: set id, part number, number of parts, size of this part, size of the whole, original file name, then a blank line) followed by the next piece of the original bytes. Joined in order without the labels the parts are exactly the original file. A backup counts as done for the reminder only when every part has been saved. To restore, choose all parts at once in Home → Import (any order) or one after another: nothing is imported until the last part arrives, a missing part is named ("Still needed: part 4"), a part that is cut short or belongs to another export is refused, and the joined file then opens as the normal single file (a split HTML study sheet is joined and saved back instead). The limit is `_sdPack.cfg.limit`.

The app's repeating checks (backup reminder, resume card, reminder dock) stop completely while the app is in the background and the start-up catch-up timer removes itself after a few seconds, so an open but idle app wakes the phone less.

## Layouts

- Phones: bottom bar, plus an optional **One-hand** layout (Settings → Appearance → Layout).
- Phones turned sideways: side bar and a two-column question with answers.
- Tablets: centred quiz column.
- Laptops and desktops (1024 px and wider): side rail, a Library with the deck list beside the open deck, and the question palette always open next to the quiz.

True black: Settings → Appearance → **True black** switches the dark theme to a pure black background for AMOLED screens (it also turns the phone's status bar black). It only applies in the dark theme, including Auto when the device is in dark mode.

Sepia tone: in the dark and true-black themes the whole app (Home, Library, Tests, Analytics, Settings, the question screen with its header, options, explanation, Ask Claude card and button bar, results, review, popups, toasts and the phone's status bar) uses warm sepia browns and cream text instead of the cool blue-grey. In true black the page stays pure black and only the cards take a deep brown. The accent, the green "correct" colour and the layouts are not changed, and the light theme never changes. It is on by default; Settings → Appearance → **Sepia tone** (under True black) switches it off, and Reset appearance puts it back on. It only re-points the colour variables (`html[data-sepia="1"]` in `dev/layers/layouts.css`), so no screen has its own copy of the colours. Text contrast on the cards is 12.2 : 1 for the main text, 10.4 : 1 for the explanation and 6.3 : 1 for the small grey text (dark), and 14.5 : 1 / 11.8 : 1 / 6.6 : 1 in true black. `tests/31_sepia_and_labels.js` visits the main screens in both themes and fails if any blue-grey surface is left.

The HTML import button, its screen title and its drop zone now read **Import HTML** / **Drop HTML file here**, and the help texts and messages of that flow no longer name a particular platform. Only the "not affiliated with …" disclaimers and the TriPath planner (which names its three source libraries) still do.

Touch screens: small buttons (switches, font-size, palette, star/hint, back) get an invisible tap area of at least 44 px tall, so the look stays the same but they are easier to hit. Option rows in Settings and the Undo button are a little taller on touch devices.

Accessibility: form fields and icon buttons have spoken names, toast messages are announced to screen readers, and the device's high-contrast setting is respected.

Keyboard: `Ctrl/⌘ + K` or `/` opens search, `Alt + 1` to `Alt + 5` switches tabs. The quiz keys (arrows, `1`–`4`, `?`) are unchanged.

## Mock tests and sorting imports

**NEET PG mock and Custom Test pick at random, but across everything.** A subject now uses all of its folder, chapters included, instead of one chapter. Inside a subject the pick takes one question from every chapter first, then adds more with a bigger share for bigger chapters (a 30-question chapter gets about 1.6 times the questions of a 12-question one, not 2.5 times). Questions you have not seen come first, questions you got wrong come back sooner, and a question that was in one of your last two tests is less likely to come again. If a subject has fewer questions than the mock asks for, the missing ones are taken from subjects that have spare, and a message says so. After the test starts a short message tells how wide it reaches ("🎯 48 questions · 4 subjects · 20 chapters · 31 new to you").

On the 252-question test deck (4 subjects, 20 chapters, 48 questions per mock), eight mocks in a row covered all 20 chapters every time. Before, a mock covered 4 of the 20 chapters, and most of its questions were repeated in the next mock.

**Imported files are sorted into subject folders.** When you open a file that has no subject folders (one long list of questions), the app reads each question and files it under Anatomy, Physiology, Pathology and so on, using a built-in list of about 2,400 medical terms. It uses the Subject column or Tags if the file has them, then the question text, then the neighbours of an unclear question. Questions it is not sure about go to a folder called **Unsorted**, so nothing is guessed silently, and a message tells how many. A file that already has subject folders, a file with fewer than 5 questions, and a file that does not look like a medical question bank are left exactly as they are. Folders called "OBG", "Paediatrics" or "Anaesthesiology" get the standard name, so the mock can find them.

Turn it off in Settings → Appearance → **Sort imports by subject**. To sort a deck you imported earlier, open its **⋯ menu → Sort by subject** (it asks first; stars, notes and test history stay with the questions, and best scores of the old folders start again).

It works on the words of the question, offline, without any AI service. On a test file written for this check (152 questions, 8 per subject, mixed) it placed 83 % of the questions and 96 % of those were in the right subject; the rest went to Unsorted. That file was written by the same person who wrote the word list, so treat the numbers as a lower bound on easy questions, not as a promise. It sorts by subject only, not by chapter.

**Uploaded files keep their folder tree.**

- *HTML question banks (saved pages with a nested folder tree).* A file that holds its questions in a nested folder tree (subject, chapter, topic, test) is now read as written, to any depth, and every folder becomes a level of the deck tree. Before, a test file with 18 questions in 14 folders came out as 2 questions on the Import HTML screen, and as 82 questions (duplicates) in 47 folders through the main Import button. Nothing in the file is run; it is only read. Answers written as a number (counting from 0) or as the option's own words are understood, a stray trailing comma is forgiven, and a generic top folder called "root" is not made into a level.
- *Anki files (APKG).* Anki always keeps an empty deck called "Default"; it used to show up as an empty folder next to your real deck. Empty folders are now left out, a file with one unnamed deck is named after the file, a flat file is sorted by subject (same rules as above), and tags such as `Anatomy::Upper_Limb` become Anatomy › Upper Limb folders.
- Both follow the same switch, Settings → Appearance → **Sort imports by subject**. Switched off, the file is left exactly as it came.
- Checked with a stand-in for the SQLite reader, not with a real Anki file: the zip, the deck tree, question detection and saving are the app's own code, but I could not run real SQLite here. Please import one of your own APKG files and look at the tree.

## Leaderboard and daily performance

**Where:** Home → Progress → **Leaderboard** (also under Tools), and Settings → **Leaderboard**. The administrator has a **Rankings** tab in the admin panel.

**You choose.** Nothing leaves the device until you tap **Join**. You pick the name others see (first name and an initial by default) and whether your college shows. **Shared:** that name, tests taken, marks, questions asked, accuracy, streak and the last 7 days. **Never shared:** email, phone, password, questions, answers, notes. **Leave** deletes your row.

**What it shows.**

- *Today, This week, All time*, for all tests, NEET mock only, or Custom Test only, ranked by **marks**, **questions** or **accuracy** (accuracy needs 20 questions, or 10 for today, so one lucky answer does not win). Ties on marks are split by accuracy.
- A strip with how many students were active, questions asked, accuracy and average marks per test; your own position and the gap to the student above you.
- Tap a student: tests, marks, questions, accuracy, streak, best NEET mock, last test and a 7-day bar chart.
- **My daily performance**: your last 14 days (questions, accuracy, tests, marks), worked out on your device even if you never join.
- *Administrator:* every registered student (not only those who joined) with email, mobile, tests, marks, questions, accuracy and last active; search, sort, **Download CSV**, remove one student's row, clear the board.

**How marks are counted.** NEET PG scheme: +4 for a right answer, −1 for a wrong one, from the answers saved with each finished test, whatever marking is set in the test. A day is the app's day (it changes at 5:30 am India time).

**How it is kept up to date.** After every finished quiz the app sends one small row for you (about 0.7 KB) and only your own row. If a figure online is larger than what this device knows (another phone, the installed app next to the browser tab, cleared data), the larger figure is kept, so a new device never shrinks your score; two devices show the larger of each figure, not the sum. Offline, it sends later.

**To switch it on:** publish the new `firebase/database.rules.json` before students update (steps in `firebase/SETUP.md`). With the old rules file the leaderboard says "The database does not allow the leaderboard yet".

**Limits, in plain words.**

- *Scores are reported by each student's phone, and Firebase cannot tell who is writing.* Anyone who reads the page source can write a row for any name, with made-up but possible numbers, or delete rows. The rules refuse impossible rows (more marks than the maximum, more right answers than questions, bad dates, long names), and the app hides them too, but they cannot refuse believable fake ones. Treat the board as friendly competition, not as proof. The fix is Firebase sign-in (see `firebase/SETUP.md`).
- Names from the database are shown as plain text, never as page code.
- Totals count the quizzes kept on the device (each deck keeps its last 300).
- The board downloads every row each time it opens (fine for hundreds or a few thousand students).
- Tested against a fake database and a stand-in for Firebase's rules engine, not against your live database. After publishing the rules, test once with two accounts, and use the **Rules Playground** in the Firebase console.

## Speed

The page no longer waits for outside servers before it starts. The four helper libraries (ZIP, SQLite, Zstandard and HLS video) and the Google Fonts stylesheet used to block the page until they answered; now the app starts at once and loads them in the background (so they are still saved for offline use). Features that need a library (Anki/APKG import, Excel+ZIP export, HLS video) wait for it if you use them in the first seconds. With a CDN that took 4 seconds to answer, the app started in about 0.13 s instead of 4.1 s.

## TriPath

TriPath (Revision Planner) opens from Home and is built into the page. It follows StudyDeck: the same colours in dark, light and true black, the same font and text size, the same top bar, bottom bar (side rail on wide screens) and back arrow. Change any of these in StudyDeck and TriPath updates at once. Its progress and plan are saved in the browser like everything else, and it has its own backup in TriPath → Settings.

TriPath's Excel import, export and blank templates need a spreadsheet library. To keep the page under 2 MB it is not stored inside the page: it loads from the same CDN as the other libraries a few seconds after TriPath opens, and the service worker keeps a copy for offline use. The very first import or export needs internet once; if it is missing you get a message that says so.

To put in a newer TriPath file:

```
python3 tools/update_tripath.py path/to/tripath.html index.html
```

This restyles the file to match StudyDeck, packs it, and replaces the old copy in `index.html` (it refuses a result of 2 MB or more). It needs Node with `esbuild` (`npm i -g esbuild`). The restyling edits exact pieces of the file and stops with a clear message if a new TriPath moved one of them.

## Checked and fixed

The main flows were run end to end with a 36-question test set (decks, Browse, quiz, flashcards, starred, custom tests, NEET PG mock, results, retry, weak areas, daily plan, search, settings, edit/delete, backup, offline). Problems found and fixed:

- **Browse** opened blank in some cases, did not highlight the chosen sort, collapsed the open card when you starred a question, and showed a stale list after you edited or deleted a question.
- **Scores** depended on the order you answered in (wrong answers could be subtracted before the points were added). The result no longer changes with order and never goes below 0.
- **Retrying a finished test** said it would repeat the test's questions but then drew new random ones. The question-source sheet now opens on "Previous test". Retried NEET tests also got a different time limit from new ones; both now use the same rule.
- **NEET PG mock**: tile labels, question count, duration and the result headline now agree (180 / 90 questions; time is 210 minutes for 180).
- **Quiz options** (count, timer, shuffle…) were changed by a one-off practice filter and some defaults were not saved. Practice filters are now temporary and the defaults persist.
- **Session history** labels name the real source (deck, Custom Test, NEET PG Mock/Test, Starred, Mixed practice).
- **Dates and streaks** use the local day, so late-night study no longer lands on the wrong date, and a streak freeze is only used after a studied day.
- **Fast taps**: an answer is locked in 0.28 s after you tap it. If you moved on inside that window (Save & Next, Mark, Back, the question palette), the answer could be lost; it is now locked in first.
- **Toasts** wrap long text instead of running off the screen.
- **Importing a CSV or Excel file** cut a multi-line explanation to its first line, silently turned a missing or unreadable correct letter into A, pointed past the options when an option cell was blank, and dropped rows with fewer than two options without a word. Line breaks inside quoted cells are now kept, `B)`, `(c)` and `Option D` are read as letters, and after the import a notice lists the row numbers that need a look.
- **Exporting to CSV or Excel** turned every line break in an explanation into a space. The Explanation column now keeps its lines, so an export can be imported again without losing the layout.
- **Test detail** counted skipped questions as wrong. It now shows Skipped on its own tile.
- **Timed exam screen** kept a 70 px blank band under the timer, so on a phone the fourth option sat behind the answer buttons. The band is gone and the buttons are tighter, so option D shows without scrolling. Turned sideways, the exam header no longer pokes out under the top bar.
- **NEET instructions**: the marking-scheme line was cut off on the right. Each line is now one flowing sentence with its number beside it.
- **Settings**: a row with three or more choices (Theme, Font, Text Size, Corner Radius, Density) puts the label on top and the choices in one equal-width row, with no lone "XL" or "Pill" on a second line.
- **Score projection** showed a number such as 423 / 720 after a single 12-question session, and opening Analytics three times counted as three check-ins for the exam-ready date. A projection now needs 100 answered questions across 5 subjects; until then Analytics shows how far along you are. The history keeps one entry per day, and the note says how many subjects are only assumed.
- **Undo and "Last question"** could stay on top of the results, and Undo then changed the score of a finished quiz. Both end with the quiz.
- **Progress** is saved the moment each answer is locked in (it used to be saved only when you moved on), so a quiz you leave after one answer can be resumed.
- **Practice quiz** ends with "Finish quiz"; a timed test still says "Submit Exam".
- **First run**: with no decks Home says "Add your questions to begin" (open a file or make a blank deck) instead of showing a daily plan for nothing, and the plan warning reads "No practice yet" instead of "Only 0 sessions".
- **Resume card** no longer floats over a sheet or dialog.
- **Keyboard-shortcuts badge** no longer sits on top of the answer options on phones (the `?` key and desktop keep it).
- **NEET subject split**: the Full Mock preview card promised Anatomy 17 / Physiology 15 / Biochemistry 15 while the grid that builds the exam used 9 / 9 / 9, and three subject ids did not match between the two lists. There is now one list (it also drives the score predictor and the daily plan). NBEMS publishes no subject-wise counts, so it is labelled "Typical subject split (estimate)" and every count can be changed. The old labels "NBE 2024 / 2026 distribution" and the predictor note "real NBE 2026 mark distribution" claimed a source that does not exist.
- **Half Mock and Apply Preset did nothing**: the exam still had every question after choosing "Half Mock · 90 Q" (the subject grid was rebuilt from scratch after the counts were set). Half is now exactly 90 questions, Full exactly 180, spread over the subjects by largest remainder (plain rounding gave 98).
- **Passwords** were stored as readable text in a database anyone can read, and the recovery screen showed them. They are now salted PBKDF2-SHA256 hashes; old accounts are upgraded when the person next signs in or when an admin opens the admin panel; recovery lets the person set a new password.
- **A failed download of the sign-up list overwrote the accounts**: it was treated as "no users", so the next sign-up replaced everyone's accounts with a list of one. A failed read or a "permission denied" answer is now an error that blocks every write, and the sign-in and sign-up screens say "Could not reach the server".
- **`tools/set_admin_password.py` could not find the admin hash in the shipped `index.html`** (it looked for single quotes and spaces; the page is minified). Fixed and tested on the built page.
- **`tools/update_tripath.py`** failed with an unhelpful "Permission denied" when the `ESBUILD` variable was set but empty. An empty value now counts as not set.
- **Reviews due**: Home shows a "N flashcards due" chip when scheduled flashcard reviews are waiting, and one tap opens them as a session.
- **Dialogs that could not scroll**: the Export Deck dialog (six formats plus the deck picker) is taller than a phone screen. It was pinned to the bottom edge and grew upward, so its title and deck picker sat above the screen and nothing scrolled. It now fits the screen, scrolls inside itself, and keeps its title in view while you scroll. The same fix covers Delete deck, Add sub-deck and the video player, and a test checks every dialog in the app at 360 x 640 and sideways.
- **NEET PG mock and Custom Test covered only one chapter per subject.** The subject was matched to the first folder whose name fitted, so with Anatomy › Upper limb / Lower limb / Thorax… a mock used one chapter, and every mock after it used the same one. A subject now uses its whole folder.
- **The shuffles were not fair.** Shuffling by `sort(() => Math.random() - .5)` favours some orders (the first items tend to stay near the front), and it was used in 22 places. It is replaced by a proper shuffle (Fisher–Yates on the browser's secure random numbers).
- **"Fresh Questions" said "no repeats from memory" but did not remember anything.** It now prefers questions you have not seen.
- **Folder names were matched by pieces of words**, so "Microscopy" or "Environmental health" could be taken for Microbiology or Anatomy. Names are now matched as whole words, with the usual short forms (OBG, DVL, PSM, ENT) and longest phrase first.
- **Retrying a previous test** looked only at the folder a subject pointed to, not at the chapters inside it. It now finds them.
- **The card after a wrong answer was hard to read.** The verdict, the right answer, the explanation and the reference ran together, the whole explanation was bold, and the result could be below the fold. Now "Incorrect — Correct: A) 20cc" is one clear line with the letter, the explanation is normal weight with bold headings, the result scrolls into view after the tap (not when you have turned motion off), and on tablets and desktops the four navigation buttons share the row evenly.
- **Nested HTML question banks lost their tree** (and the main Import button multiplied the questions). See "Uploaded files keep their folder tree".
- **Anki decks showed an empty "Default" folder** and a flat deck was not sorted. Fixed.
- **A student's score could shrink** if they opened the app on a new device. Not possible in the new leaderboard: larger figures win.


## Checks

`tests/` holds 33 end-to-end checks (733 assertions) that open the page in Chromium and use it like a student: quizzes, tests, import and export, backup and restore, themes, TriPath. They run on every push and pull request, and the site is only published when they pass. To run them yourself: `cd tests && npm install && npx playwright install chromium && npm test`.

## Run it locally

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Offline use and install work on `localhost` and on HTTPS addresses, not when `index.html` is opened as a plain file.

## Changing the app

Simple way: edit `index.html`, commit, push. Keep it under 2 MB: the workflow stops the deploy if it grows past that.

Cleaner git history (optional): split the page into parts, edit a part, and join them again.

```
python3 tools/split.py index.html src        # writes src/css, src/js, src/data, src/html
python3 tools/build.py src index.html        # joins them back, byte for byte
python3 tools/build.py src index.html --check
```

`build.py` refuses to write a page of 2 MB or more. The original app code is minified, so changes inside it still show as long lines; the parts added later (`dev/layers/`) are readable.
