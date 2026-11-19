#!/usr/bin/env python3
"""Split the single-file app into readable parts so git shows small, per-part diffs.

    python3 tools/split.py index.html src

Writes src/manifest.json plus one file per <style> / <script> block (css/, js/, data/) and per run of
page markup (html/). tools/build.py joins them back into index.html byte for byte."""
import hashlib, json, os, re, sys

if len(sys.argv) != 3:
    sys.exit(__doc__)
src_path, out = sys.argv[1], sys.argv[2]
raw = open(src_path, 'rb').read()
text = raw.decode('utf-8')
if os.path.exists(out) and os.listdir(out):
    sys.exit('%s is not empty. Remove it first so no old parts are left behind.' % out)

block = re.compile(r'(<(style|script)\b[^>]*>)(.*?)(</\2>)', re.S | re.I)
parts, pos, n = [], 0, 0

def add(kind, ext, body, extra=None):
    global n
    n += 1
    name = '%s/%03d%s.%s' % (kind, n, ('-' + extra) if extra else '', ext)
    path = os.path.join(out, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(body)
    return name

for m in block.finditer(text):
    if m.start() > pos:
        parts.append({'file': add('html', 'html', text[pos:m.start()])})
    open_tag, tag, inner, close_tag = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
    ident = re.search(r'\bid="([\w-]+)"', open_tag)
    ident = ident.group(1) if ident else None
    if tag == 'style':
        kind, ext = 'css', 'css'
    elif re.search(r'type="text/plain"', open_tag, re.I):
        kind, ext = 'data', 'txt'
    else:
        kind, ext = 'js', 'js'
    parts.append({'file': add(kind, ext, inner, ident), 'open': open_tag, 'close': close_tag})
    pos = m.end()
if pos < len(text):
    parts.append({'file': add('html', 'html', text[pos:])})

os.makedirs(out, exist_ok=True)
manifest = {'format': 1, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'parts': parts}
with open(os.path.join(out, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=1)
print('Wrote %d parts to %s/ (%d bytes in the page)' % (len(parts), out, len(raw)))
