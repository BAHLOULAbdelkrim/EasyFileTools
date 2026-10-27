"""Usage: python scripts/check-seo.py public [preview-output]
Checks generated HTML and sitemap using Python's standard library only.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import collections, json, re, sys
import xml.etree.ElementTree as ET

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)
        self.schemas = [json.loads(x) for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)]
        self.titles = re.findall(r'<title>(.*?)</title>', text, re.S)
    def select(self, tag, **values):
        return [attrs for name, attrs in self.tags if name == tag and all(attrs.get(k) == v for k, v in values.items())]
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

def check(folder, preview=False):
    errors, titles, descriptions, canonical = [], [], [], []
    pages = list(folder.rglob('*.html'))
    if not pages:
        raise SystemExit('No HTML found in ' + str(folder))
    for file in pages:
        name = file.relative_to(folder).as_posix()
        page = Page(file.read_text(encoding='utf-8'))
        robots = page.select('meta', name='robots')
        description = page.select('meta', name='description')
        if len(page.titles) != 1 or len(robots) != 1 or len(description) != 1:
            errors.append(name + ': missing or duplicated metadata')
            continue
        indexable = 'noindex' not in robots[0]['content']
        if preview and indexable:
            errors.append(name + ': preview is indexable')
        if indexable:
            links = page.select('link', rel='canonical')
            if len(links) != 1 or not links[0]['href'].startswith('https://'):
                errors.append(name + ': invalid canonical')
            else:
                canonical.append(links[0]['href'])
            if len(page.select('h1')) != 1 or not page.schemas:
                errors.append(name + ': missing H1 or structured data')
            titles.extend(page.titles)
            descriptions.append(description[0]['content'])
        for tag, attrs in page.tags:
            key = 'href' if tag == 'a' else 'src' if tag in ('img', 'script') else 'href' if tag == 'link' and attrs.get('rel') == 'stylesheet' else None
            if not key or not attrs.get(key):
                continue
            url = urlsplit(attrs[key])
            if url.scheme or url.netloc or not url.path:
                continue
            target = folder / unquote(url.path.lstrip('/')) if url.path.startswith('/') else file.parent / unquote(url.path)
            if not target.is_file() and not (target / 'index.html').is_file():
                errors.append(name + ': missing local target ' + attrs[key])
    sitemap = [n.text for n in ET.parse(folder / 'sitemap.xml').findall('.//{*}loc')]
    if set(sitemap) != set(canonical) or len(sitemap) != len(set(sitemap)):
        errors.append('Sitemap and indexable canonical URLs disagree')
    for label, values in [('title', titles), ('description', descriptions)]:
        for value, count in collections.Counter(values).items():
            if count > 1:
                errors.append('Duplicate ' + label + ': ' + value)
    print(json.dumps({'folder': str(folder), 'html_pages': len(pages), 'indexable_pages': len(canonical), 'sitemap_urls': len(sitemap), 'errors': errors}, indent=2))
    return not errors

if __name__ == '__main__':
    ok = check(Path(sys.argv[1] if len(sys.argv) > 1 else 'public'))
    if len(sys.argv) > 2:
        ok = check(Path(sys.argv[2]), preview=True) and ok
    sys.exit(0 if ok else 1)
