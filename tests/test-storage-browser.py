"""Run with Python Playwright + Chromium after starting a static server at the project root.
    python -m http.server 8766
    python tests/test-storage-browser.py
"""
from playwright.sync_api import sync_playwright
import shutil
import os
BASE='http://127.0.0.1:8766'
SOURCE='/themes/high-tech-theme/static/js/common/file-storage.js'

def attach(page):
    page.add_script_tag(url=BASE+SOURCE)
    page.evaluate('ensureFileStorageSession()')

with sync_playwright() as p:
    chromium = shutil.which("chromium") or shutil.which("chromium-browser")
    kwargs = {"executable_path": chromium} if chromium else {}
    browser=p.chromium.launch(headless=True, args=['--no-sandbox'] if os.name != 'nt' else [], **kwargs)
    context=browser.new_context()
    a=context.new_page(); a.goto(BASE+'/tests/storage-harness.html'); attach(a)
    a_id=a.evaluate('sessionStorage.getItem("easyfiletools:file-session-v2")')
    a.evaluate('saveSelectedFiles([new File(["AAAA"],"a.pdf",{type:"application/pdf"})],"Document")')
    b=context.new_page(); b.goto(BASE+'/tests/storage-harness.html')
    # Force the sessionStorage value that Chromium may clone when duplicating a tab.
    b.evaluate('(id) => sessionStorage.setItem("easyfiletools:file-session-v2", id)',a_id)
    attach(b)
    b_id=b.evaluate('sessionStorage.getItem("easyfiletools:file-session-v2")')
    assert b_id != a_id, 'Duplicated tab must get new key'
    assert b.evaluate('loadSelectedFiles()') is None, 'Tab B must not restore Tab A files'
    b.evaluate('saveSelectedFiles([new File(["BBBB"],"b.pdf",{type:"application/pdf"})],"Document")')
    assert a.evaluate('loadSelectedFiles().then(v => v.files[0].file.name)')=='a.pdf'
    assert b.evaluate('loadSelectedFiles().then(v => v.files[0].file.name)')=='b.pdf'
    b.evaluate('clearStoredFiles()')
    assert a.evaluate('loadSelectedFiles().then(v => v.files[0].file.name)')=='a.pdf', 'Clearing B must not touch A'
    a.reload(); attach(a)
    assert a.evaluate('loadSelectedFiles().then(v => v.files[0].file.name)')=='a.pdf', 'Reload must restore selection'
    assert a.evaluate('sessionStorage.getItem("easyfiletools:file-session-v2")')==a_id
    a.close(); b.close(); browser.close()
    print('PASS: duplicate tab collision, distinct data, clear independence, refresh restoration')
