#!/usr/bin/env python3
"""Point StudyDeck at your own Firebase Realtime Database.

    python3 tools/set_firebase.py index.html https://YOUR-PROJECT-default-rtdb.firebaseio.com
    python3 tools/set_firebase.py index.html --show

Only the database address inside index.html is changed (nothing else is touched). Run it before you publish,
then commit/upload the changed index.html. See firebase/SETUP.md for the whole setup."""
import argparse, re, sys

ap = argparse.ArgumentParser()
ap.add_argument('file', help='path to index.html')
ap.add_argument('url', nargs='?', help='your database address, e.g. https://my-app-default-rtdb.firebaseio.com')
ap.add_argument('--show', action='store_true', help='print the address the page uses now and stop')
a = ap.parse_args()

s = open(a.file, encoding='utf-8').read()
pat = re.compile(r"""FB:(["'])(https://[^"']+)\1""")
found = pat.findall(s)
if len(found) != 1:
    sys.exit('Could not find the database address in this file (is it the StudyDeck index.html?). Nothing was changed.')
old = found[0][1]
if a.show or not a.url:
    print('This page uses:', old)
    sys.exit(0)

url = a.url.strip().rstrip('/')
if not re.fullmatch(r'https://[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)', url):
    sys.exit('That does not look like a Realtime Database address. It should look like\n'
             '  https://my-project-default-rtdb.firebaseio.com   or   https://my-project-default-rtdb.europe-west1.firebasedatabase.app\n'
             '(copy it from Firebase console > Build > Realtime Database, top of the Data tab). Nothing was changed.')
if url == old:
    sys.exit('The page already uses this address. Nothing was changed.')
s = pat.sub(lambda m: 'FB:%s%s%s' % (m.group(1), url, m.group(1)), s)
open(a.file, 'w', encoding='utf-8', newline='').write(s)
print('Database address changed.\n  was:', old, '\n  now:', url)
print('Next: publish firebase/database.rules.json in the Firebase console (Rules tab) if you have not yet, then upload index.html.')
