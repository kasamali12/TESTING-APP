# Firebase setup for StudyDeck

StudyDeck needs Firebase for two things only:

- the **sign-up list**: name, mobile, email, a hash of the password, payment status, passkey, blocked or not;
- the **payment settings** the admin edits: UPI ID, amount, note, QR image.

Your questions, scores and progress never go to Firebase. They stay on the device.

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

Nothing in `database.rules.json` can stop this. Only real sign-in can. Until then:

- keep this project separate from anything else you run on Firebase;
- check the admin panel's payments against your actual UPI statement before approving, rather than trusting the status field alone;
- look at the UPI ID in Settings now and then to make sure it is still yours.

## The proper fix (when you are ready)

Move sign-in to **Firebase Authentication** (email and password) and give each account only access to its own record, with the admin recognised by a Firebase account id instead of a password typed into the page. That closes the list to the public and makes the UPI setting read-only for everyone but you.

It needs a Firebase project to test against, so it has to be done with your project. It changes the sign-up, sign-in, recovery, approval and payment-settings code, which is why it is not part of this release. When you have created the project from steps 1 to 2 above and enabled **Authentication > Sign-in method > Email/Password**, that work can start.
