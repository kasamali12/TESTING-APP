#!/usr/bin/env python3
"""Join the parts written by tools/split.py back into one index.html.

    python3 tools/build.py src index.html          build
    python3 tools/build.py src index.html --check  only report whether index.html is up to date

Also refuses to write a page of 2,000,000 bytes or more (the size limit this app keeps)."""
import hashlib, json, os, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
check = '--check' in sys.argv
if len(args) != 2:
    sys.exit(__doc__)
src, dst = args
man = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))
chunks = []
for p in man['parts']:
    with open(os.path.join(src, p['file']), 'r', encoding='utf-8', newline='') as f:
        body = f.read()
    chunks.append(p.get('open', '') + body + p.get('close', ''))
data = ''.join(chunks).encode('utf-8')
if len(data) >= 2000000:
    sys.exit('Page would be %d bytes, over the 2,000,000 byte limit. Not written.' % len(data))
if check:
    cur = open(dst, 'rb').read() if os.path.exists(dst) else b''
    same = cur == data
    print('index.html is %s the parts in %s/' % ('UP TO DATE with' if same else 'DIFFERENT from', src))
    sys.exit(0 if same else 1)
open(dst, 'wb').write(data)
print('Built %s: %d bytes, sha256 %s' % (dst, len(data), hashlib.sha256(data).hexdigest()[:16]))
