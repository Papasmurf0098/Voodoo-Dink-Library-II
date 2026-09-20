"""Extract original cocktail pages without retyping or altering recipe content.

Usage: python scripts/extract-build-sheets.py /path/to/source.pdf
Requires pypdf. Run only after reviewing the source and page mapping.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
reader = PdfReader(source)
assert len(reader.pages) == 30, 'Expected the reviewed 30-page training document'
assert hashlib.sha256(source.read_bytes()).hexdigest() == '319da5fbec8567b37b3e514f5c412cc1ded7e60ee5dddc0bd36d04f1331b690c', 'Source changed; review mapping before extraction'
mapping = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    'import { COCKTAIL_BUILD_SHEETS as sheets } from "./js/build-sheets.js"; console.log(JSON.stringify(sheets));'
], cwd=root, text=True))
target = root / 'assets' / 'build-sheets'
target.mkdir(parents=True, exist_ok=True)
for drink_id, sheet in mapping.items():
    page = reader.pages[sheet['page'] - 1]
    writer = PdfWriter()
    writer.add_page(page)
    writer.pages[0].compress_content_streams()
    writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    writer.add_metadata({'/Title': sheet['title'] + ' - Build sheet', '/Subject': f"Original training document, page {sheet['page']}"})
    path = target / f'{drink_id}.pdf'
    with path.open('wb') as output:
        writer.write(output)
    result = PdfReader(path)
    assert len(result.pages) == 1
    assert result.pages[0].extract_text() == page.extract_text(), drink_id
    assert result.pages[0].mediabox == page.mediabox, drink_id
print(f'Extracted and text-checked {len(mapping)} original cocktail pages.')
