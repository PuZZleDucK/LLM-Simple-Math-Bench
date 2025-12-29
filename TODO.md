# TODO

- [ ] Add `AGENTS.md` and split repo guidance:
  - Keep `README.md` user-facing: what it is, quick start (`./serve.rb`), where to click, how to publish results.
  - Put contributor/agent instructions in `AGENTS.md`: code layout, key files (`app.js`, `serve.rb`, `results.js`), local dev workflow, conventions (e.g. avoid breaking CSV schema), and “how to validate”.
  - Document runtime assumptions/limits in `AGENTS.md`: Ollama endpoints used (`/api/tags`, `/api/chat`, `/api/ps`, `/api/show`), what’s best-effort (CPU/GPU split + ctx estimate), and how to troubleshoot when Ollama returns empty content.

