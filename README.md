# DataEngine Demo

The X5 Task Atlas links each RoboDojo preset YAML to its rollout outcomes, timing, and synchronized head and wrist recordings. The earlier demo gallery and comparison plots are available at `archive.html`.

- `benchmark.json` contains the published task summaries and attempt ledger.
- `preset-summary.csv` contains comparable success, coverage, speed, and wrist-roll statistics per preset.
- `attempts.csv` contains the per-attempt statistics for analysis.
- `videos/x5-benchmark/` and `posters/x5-benchmark/` contain the corresponding browser-ready artifacts.
- `index.html` embeds the benchmark data to support browsing an offline checkout.

After regenerating the JSON and CSV from the native results, run `python3 scripts/embed_benchmark.py` and check synchronized playback and task selection in a browser. GitHub Pages publishes the root of `main`.

The SimBox cohort runs fixed seeds per YAML. Goal-success and execution-completion rates have separate denominators. Push-T replay reports its native pass count and quota skips separately. The site explains the render, capture, and attempt timing definitions.
