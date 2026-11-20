"""Cache busting for the static site: append ?v=<content hash> to every local .js/.css reference in the HTML pages.

Browsers (Firefox especially, behind servers that send no Cache-Control header such as `python -m http.server`)
may keep serving an old copy of a script. With a content hash in the URL a changed file is always fetched anew,
an unchanged one stays cached. Run after editing any .js/.css file:

    python tools/cache-bust.py
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = re.compile(r'(?P<attr>(?:src|href))="(?P<path>(?!https?:|//|#|data:)[^"?#]+\.(?:js|css))(?:\?v=[0-9a-f]*)?"')


def main():
    changed = 0
    for html in sorted(ROOT.glob('index.html')) + sorted(ROOT.glob('widgets/*/index.html')):
        text = html.read_text(encoding='utf-8')

        def stamp(m):
            target = (html.parent / m.group('path')).resolve()
            if not target.is_file():
                raise SystemExit(f'{html.relative_to(ROOT)}: missing {m.group("path")}')
            digest = hashlib.sha1(target.read_bytes()).hexdigest()[:10]
            return f'{m.group("attr")}="{m.group("path")}?v={digest}"'

        new = REF.sub(stamp, text)
        if new != text:
            html.write_text(new, encoding='utf-8', newline='\n')
            changed += 1
            print('updated', html.relative_to(ROOT))
    print(f'{changed} page(s) updated')


if __name__ == '__main__':
    main()
