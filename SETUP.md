# Firebase setup for StudyDeck

StudyDeck needs Firebase for three things:

- the **sign-up list**: name, mobile, email, a hash of the password, payment status, passkey, blocked or not;
- the **payment settings** the admin edits: UPI ID, amount, note, QR image;
- the **leaderboard** (`studydeck_rank`), only for students who tap Join: a display name, optionally the college, and counts (tests, marks, questions, accuracy, streak, last 7 days).

Your questions, answers, notes and progress details never go to Firebase. They stay on the device. The leaderboard row holds counts only, never an email, phone number or password.

Without a database the app still opens and works as a study tool, but nobody can sign up, sign in or be approved.

## Set it up (about 10 minutes)

1. Go to <https://console.firebase.google.com> and choose **Add project**. Use a **new project just for StudyDeck**. Do not reuse a project that holds another app's data (see "What the rules do not protect" below). Google Analytics can stay off.
2. In the new project open **Build > Realtime Database > Create Database**. Pick the region closest to your students and start in **locked mode**.
3. Open the **Rules** tab, delete what is there, paste the whole of [`database.rules.json`](database.rules.json) and press **Publish**.
4. Back on the **Data** tab, copy the address at the top. It looks like `https://my-project-default-rtdb.firebaseio.com`.
5. In this repo, run:

   ```
   python3 tools/set_firebase.py index.html https://my-project-default-rtdb.firebaseio.com
   ```

   It changes only that one address inside `index.html` and refuses anything that does not look like a Realtime Database address. `--show` prints the address the page uses now.
6. Choose the admin password. It is stored only as a salted hash:

   ```
   python3 tools/set_admin_password.py index.html
   ```

   The admin email is set in the page; it is the one the sign-in form recognises as the admin.
7. Commit and push `index.html`. GitHub Pages deploys it after the checks pass.
8. Try it once as a student: register, tap "I Have Paid — Notify Admin", then sign in as the admin, approve the account, and sign in with the passkey. Open the Firebase **Data** tab while you do this and you will see the `studydeck_users` and `studydeck_settings` nodes appear.

**Order matters.** Publish the rules (step 3) before you upload the page with the new address (step 7). A new database in locked mode refuses everything until the rules are published, and sign-up would show "Could not reach the server".

## The leaderboard

- Each student writes only their own row, `studydeck_rank/sum/<their id>`, never the sign-up list. The admin Rankings tab reads the sign-up list to show every registered student next to their numbers.
- `database.rules.json` has a block for `studydeck_rank` that checks the shape of every row: name 1 to 40 letters, counts in a believable range, marks between minus a quarter of the maximum and the maximum, right answers never above questions asked, dates as `YYYY-MM-DD`, last-active time not in the future, no unknown fields. Publish the file **before** students update the app; with the older rules the leaderboard answers "The database does not allow the leaderboard yet".
- Rows are read by everyone (that is what a leaderboard is). Rows hold no contact details.
- Test it once in the console: **Realtime Database > Rules > Rules Playground**. Simulate a `set` at `/studydeck_rank/sum/test1` with a small valid row (it should pass) and one with marks above `2000 * tests` (it should fail). The repository's checks run the rules in a stand-in for Google's engine (`tests/rules_eval.js`); that is a good sign, not a replacement for the Playground.

## Notifications

The app has a notice board. The administrator writes a notice (Admin panel > **Notify**); every phone shows it as a card on Home, in Settings > **Notifications**, and, inside the APK, as an Android notification when the builder's JavaScript bridge is on.

**Set it up (5 minutes, once):**

1. Make a secret key of 12 to 64 letters, numbers, `-` or `_`. For example: `python3 -c "import secrets; print(secrets.token_urlsafe(24))"`.
2. Open **Realtime Database > Rules** in the Firebase console, paste the whole of [`database.rules.json`](database.rules.json) (it now has a `studydeck_notice` block), then use find and replace to change **every** `CHANGE_ME_NOTICE_KEY` into your key (it appears twice). Press **Publish**. Do not put the key into the file in this repository: the repository copy keeps the placeholder, so the key never reaches GitHub or the page.
3. Sign in as the administrator, open **Notify**, write a title and a message, type the key and press **Send to everyone**. The key is kept in memory only, until the app is closed, and is never saved on the phone.

**What reaches whom, in plain words.**

- Phones look for notices when the app opens, when it comes back to the screen, and when the phone comes back online, at most once every 10 minutes. Nothing runs in between, so it costs no battery.
- A phone whose app is **closed** cannot be reached this way. For that, use the APK builder's own push: **Push with Firebase** (builder step 10) and then **⋮ > Send notification** in the builder. The **Copy for push** button on the Notify screen copies the title and message so the same words go to both.
- Inside the APK, switch **JavaScript bridge** on (builder step 11). The Notify screen then lists what the bridge offers and has a **Show a test notification here** button. The app calls `FreeApp.notify(title, message)`; if your builder's version expects other arguments, the button will tell you it did not work. Send a screenshot of that screen and the call can be changed.
- At most the newest 20 notices are kept; sending a 21st drops the oldest. **Remove** on a card deletes it for everyone.

**What the rules do.**

- Anyone may read the notices. Nobody can read the key.
- A write to the notice list is accepted only in the same update that writes the key node with the server's own clock (`w/<your key>/t`). The key is in the path, so someone who does not know it cannot write the node at all, and an old stored time cannot be replayed because it is not equal to `now`.
- Every notice is checked: id `n` plus 4 to 12 lower-case letters or digits, title 1 to 80 letters, message up to 400, link up to 300 and starting with `https://`, time not more than 5 minutes ahead of the server, no other field.
- The app also checks everything it reads (and shows it as plain text, never as page code), so even a wrong row would be dropped.

**Limits.**

- Whoever knows the key can post. Change it in the console (both places) to cancel the old one; nothing in the app needs updating.
- The Rules Playground cannot test a multi-path update, so the live check is to send one real notice from the Notify screen. If the screen says "Firebase refused it", the key or the rules are not the same in the two places. The repository's checks (`tests/34_notifications.js`) run the rules in a stand-in for Google's engine, not in Google's engine.
- Until the new rules are published, phones show "The notice board is not switched on in Firebase yet" on the Notifications screen and everything else keeps working.

## What the app does with passwords now

- A password is stored as a salted PBKDF2-SHA256 hash (150,000 rounds), never as text.
- Accounts created by older versions are upgraded the next time that person signs in, or when an admin opens the admin panel (it secures every remaining one in a single write). After that the readable password is gone from the database.
- "Forgot password" no longer displays the old password. After the identity check the person sets a new one.
- If the sign-up list cannot be downloaded (no connection, or the database says "permission denied"), the app says so and writes nothing. Older versions treated that as "no users" and the next sign-up would have replaced everyone's accounts with a list of one.

## What the rules do protect

- Everything else in the same Firebase project is closed (`.read` and `.write` are off at the top).
- A write that would delete or empty the `users` list or the payment settings is refused, and so is one that no longer has a `users` list (or, for the settings, a UPI ID and an amount).

## What the rules do not protect

StudyDeck has no server. The page talks to the database directly, and the database cannot tell one person from another because nobody signs in to Firebase itself. So the two nodes above have to be open to anyone who has the page address. That means anyone who reads the page source can:

- read the sign-up list: names, mobile numbers, emails, passkeys and the password hashes;
- change a record, for example mark their own account approved, or change the UPI ID that new students are shown.

The leaderboard has the same limit: a person who reads the page source can write or delete any student's row, or post believable made-up numbers. The rules only refuse impossible ones. Nothing in `database.rules.json` can stop this. Only real sign-in can. Until then:

- keep this project separate from anything else you run on Firebase;
- check the admin panel's payments against your actual UPI statement before approving, rather than trusting the status field alone;
- look at the UPI ID in Settings now and then to make sure it is still yours.

## The proper fix (when you are ready)

Move sign-in to **Firebase Authentication** (email and password) and give each account only access to its own record, with the admin recognised by a Firebase account id instead of a password typed into the page. That closes the list to the public and makes the UPI setting read-only for everyone but you.

It needs a Firebase project to test against, so it has to be done with your project. It changes the sign-up, sign-in, recovery, approval and payment-settings code, which is why it is not part of this release. When you have created the project from steps 1 to 2 above and enabled **Authentication > Sign-in method > Email/Password**, that work can start.
