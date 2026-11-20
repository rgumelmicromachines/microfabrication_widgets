"""Local preview server: like `python -m http.server`, but tells the browser not to reuse stale copies.

    python tools/serve.py            # http://localhost:8765
    python tools/serve.py 8000       # another port

Python's built-in server sends no Cache-Control header, so browsers (Firefox in particular) may show an old
version of a page or script after it was edited. This server sends `Cache-Control: no-cache`, which makes the
browser revalidate every file on each load (unchanged files still come back as 304 Not Modified).
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'Serving {ROOT} at http://localhost:{port}  (Ctrl+C to stop)')
        httpd.serve_forever()


if __name__ == '__main__':
    main()
