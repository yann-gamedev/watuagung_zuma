"""Extract actual PDF text/page sizes for LetterPdfTest. Requires Python + pypdf (test tooling only)."""
import io
import json
import sys

from pypdf import PdfReader

reader = PdfReader(io.BytesIO(sys.stdin.buffer.read()))
print(json.dumps({
    "text": " ".join(" ".join(page.extract_text().split()) for page in reader.pages),
    "pages": [[float(page.mediabox.width), float(page.mediabox.height)] for page in reader.pages],
}))
