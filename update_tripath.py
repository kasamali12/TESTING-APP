#!/usr/bin/env python3
"""Put a new version of TriPath into StudyDeck.

    python3 tools/update_tripath.py tripath.html index.html

Takes the stand-alone TriPath page, makes it use StudyDeck's colours, font, top bar and bottom bar
(tools/tripath_embed.py), packs it the way the app stores it, and replaces the old copy inside
index.html. The result must stay under 2,000,000 bytes.

Needs Python 3 and, for the size, Node with esbuild (set ESBUILD to its path if it is not in PATH).
TriPath's own data (progress, plan, settings) lives in the browser and is not touched."""
import base64, json, os, re, shutil, subprocess, sys, tempfile, zlib

if len(sys.argv) != 3:
    sys.exit(__doc__)
tp_src, index = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
if not os.environ.get('ESBUILD'):
    found = shutil.which('esbuild')
    if found:
        os.environ['ESBUILD'] = found
    elif not os.path.exists('/opt/npm-tools/node_modules/.bin/esbuild'):
        sys.exit('esbuild was not found. Install it (npm i -g esbuild) or set ESBUILD to its path; without it the page is too big.')

with tempfile.TemporaryDirectory() as tmp:
    emb = os.path.join(tmp, 'embedded.html')
    subprocess.run([sys.executable, os.path.join(here, 'tripath_embed.py'), tp_src, emb], check=True)
    tp = open(emb, encoding='utf-8').read()

segs, pos, cnt = [], 0, 0                      # alternate text / binary: the big base64 data sets are stored as raw bytes
for m in re.finditer(r'[A-Za-z0-9+/]{1000,}={0,2}', tp):
    run = m.group(0)
    if len(run) % 4:
        continue
    try:
        raw = base64.b64decode(run, validate=True)
    except Exception:
        continue
    if base64.b64encode(raw).decode('ascii') != run:
        continue
    segs.append(tp[pos:m.start()].encode('utf-8')); segs.append(raw); pos = m.end(); cnt += 1
segs.append(tp[pos:].encode('utf-8'))
for k in range(0, len(segs), 2):
    assert not segs[k].startswith(b'\xef\xbb\xbf')
stream = json.dumps([len(b) for b in segs], separators=(',', ':')).encode('ascii') + b'\n' + b''.join(segs)
c = zlib.compressobj(9, zlib.DEFLATED, -15, 9)
packed = c.compress(stream) + c.flush()
assert zlib.decompress(packed, -15) == stream
assert ''.join(base64.b64encode(b).decode('ascii') if i & 1 else b.decode('utf-8') for i, b in enumerate(segs)) == tp, 'does not round-trip'

page = open(index, encoding='utf-8').read()
pat = re.compile(r'(<script type="text/plain" id="tripath-data" data-n=")\d+(">)[A-Za-z0-9+/=\s]*(</script>)')
assert len(pat.findall(page)) == 1, 'could not find the TriPath data in %s' % index
page = pat.sub(lambda m: m.group(1) + str(len(stream)) + m.group(2) + base64.b64encode(packed).decode('ascii') + m.group(3), page, count=1)
out = page.encode('utf-8')
if len(out) >= 2000000:
    sys.exit('New page would be %d bytes, over the 2,000,000 byte limit. Not written.' % len(out))
open(index, 'wb').write(out)
print('TriPath updated: %d data sets, packed %d bytes. %s is now %d bytes.' % (cnt, len(packed), index, len(out)))
