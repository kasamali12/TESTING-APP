#!/usr/bin/env python3
"""Change the admin password stored in StudyDeck's index.html.

    python3 tools/set_admin_password.py index.html

You type the new password twice (it is not shown). The file keeps only a salted PBKDF2-SHA256 hash,
never the password. Run it again any time to change it. Then commit/upload the changed index.html.
For scripts: --password-env NAME reads the password from that environment variable instead."""
import argparse, getpass, hashlib, os, re, sys

ITER = 150000
ap = argparse.ArgumentParser()
ap.add_argument('file', help='path to index.html')
ap.add_argument('--password-env', metavar='NAME')
a = ap.parse_args()

if a.password_env:
    pw = os.environ.get(a.password_env, '')
else:
    pw = getpass.getpass('New admin password: ')
    if pw != getpass.getpass('Type it again: '):
        sys.exit('The two passwords are different. Nothing was changed.')
pw = pw.strip()   # the sign-in form trims the password before checking it
if len(pw) < 10:
    sys.exit('Use at least 10 characters. Nothing was changed.')

s = open(a.file, encoding='utf-8').read()
# The settings are written as AH:"<hash>",AS:"<salt>",AI:15e4 in the built page (single or double quotes, with or without spaces).
pat = re.compile(r"""AH:(["'])[0-9a-f]{64}\1\s*,\s*AS:(["'])[0-9a-f]+\2\s*,\s*AI:[0-9.e+]+""")
if len(pat.findall(s)) != 1:
    sys.exit('Could not find the admin hash in this file (is it the StudyDeck v40 index.html?). Nothing was changed.')
salt = os.urandom(16)
h = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, ITER, 32).hex()
s = pat.sub(lambda m: 'AH:"%s",AS:"%s",AI:%d' % (h, salt.hex(), ITER), s)
open(a.file, 'w', encoding='utf-8', newline='').write(s)
print('Admin password updated in', a.file)
