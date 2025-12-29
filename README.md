# LLM Simple Math Bench

This repo is a tiny, self-hostable benchmark UI for running a fixed suite of simple math tests against your local Ollama models, storing results to `data/results.csv`, and publishing the latest aggregates via GitHub Pages.

Published results:

- https://puzzleduck.github.io/LLM-Simple-Math-Bench/

## Requirements

- Ollama running locally (default URL in the UI is `http://127.0.0.1:11434`)
- Ruby (for `serve.rb`) or any static file server

## Run Locally

Start the local server (serves the UI and provides the results API):

```bash
./serve.rb
```

Then open:

- `http://localhost:4567/run.html` (run benchmarks, writes `data/results.csv`)
- `http://localhost:4567/` (published-style view of `data/results.csv`)

## How Runs Work

- Each test is repeated **5 times** per model (`RUNS_PER_TEST = 5`).
- Each test case is scored **0–2** (contains + exact), so a 5-case test is **out of 50**.
- The per-test cell shows:
  - `avg <time>` = average time per *test run* (total time across 5 repeats ÷ 5)
  - `avg <tok/s>` = average eval tokens/sec across the 5 repeats
- If an error happens mid-run, the UI shows a toast immediately.

## Model Runtime Info

After the first completed test for a model, the UI queries Ollama for runtime info and shows it under the model name:

- CPU/GPU % split (best-effort based on loaded VRAM share from `/api/ps`)
- Running model size (GB)
- Context size `ctx ~X GB` (best-effort estimate from `/api/show`; may be unavailable or approximate)

## Results Storage & Publishing

- Live runs are stored via `POST /api/results` and written to `data/results.csv`.
- GitHub Pages publishes `index.html`, `run.html`, and `data/results.csv` on pushes to `main` (see `.github/workflows/deploy-pages.yml`).
