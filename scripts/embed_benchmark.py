"""Mirror benchmark.json into the standalone gallery for file:// playback."""

import json
from pathlib import Path

site = Path(__file__).resolve().parents[1]
data = json.loads((site / "benchmark.json").read_text(encoding="utf-8"))
encoded = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":")).replace("<", "\\u003c")
index = site / "index.html"
document = index.read_text(encoding="utf-8")
marker = '<script id="benchmark-data" type="application/json">'
before, found, after = document.partition(marker)
if not found or "</script>" not in after:
    raise ValueError("The benchmark data element is missing")
_, closing, remainder = after.partition("</script>")
index.write_text(before + found + encoded + closing + remainder, encoding="utf-8")
