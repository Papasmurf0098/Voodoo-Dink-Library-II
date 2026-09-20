"""Compare every extracted PDF's rendered pixels against its source page.
Usage: python scripts/verify-build-sheets.py /path/to/source.pdf
Requires Poppler and Pillow. Temporary renderings are automatically removed.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[1]
mapping = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    'import { COCKTAIL_BUILD_SHEETS as sheets } from "./js/build-sheets.js"; console.log(JSON.stringify(sheets));'
], cwd=root, text=True))
with tempfile.TemporaryDirectory(prefix='cocktail-sheet-qa-') as directory:
    for drink_id, sheet in mapping.items():
        for name, file, page in [('source', Path(sys.argv[1]), sheet['page']), ('output', root / sheet['href'], 1)]:
            subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-singlefile', '-scale-to', '1440', '-png', str(file), str(Path(directory) / name)], check=True, capture_output=True)
        with Image.open(Path(directory) / 'source.png') as source, Image.open(Path(directory) / 'output.png') as output:
            assert source.size == output.size, drink_id
            assert ImageChops.difference(source.convert('RGB'), output.convert('RGB')).getbbox() is None, f'Render differs: {drink_id}'
        print(f'Pixel match: {drink_id}')
