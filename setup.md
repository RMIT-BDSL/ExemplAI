<center>
  <h1>Running the project</h1>
</center>

Before running the project, please make sure that following are installed on your machine:

- Node.js (v20 or above)
- pnpm
- uv

Although optional, we recommends installing Moon (https://moonrepo.dev/) for better developer experience and quicker
workflow.

## Development

Run the terminal in its respective directory and run the following commands:

**Note:** Currently you can only either run frontend or admin separately. We are working on making it possible to run both at the same time.

To run the development frontend, run:

```bash
pnpm run dev
```

in web.

If you want to run admin, run the similar command on /admin directory instead.

For Python, we need to initialize the project if haven't already:

```python
uv init
```

Then sync the project:

```python
uv sync
```

Finally, start the server with:

```bash
uv run fastapi dev
```

This will start the server on [http://localhost:8000](http://localhost:8000).

## LLM configuration

The agent uses **OpenRouter** as its LLM route by default. To set it up:

1. Create an API key at https://openrouter.ai and copy it.
2. In `server/.env`, set:
   ```
   OPENROUTER_API_KEY=<your key>
   OPENROUTER_ENABLED=True      # enabled by default
   ```
3. Restart the server.

Two model roles, with defaults in `server/config.py` chosen by the evaluation in
`docs/evaluation/2026-10-07-model-latency.md`:

| Role | Used by | Default model | Reasoning |
|---|---|---|---|
| agent | example and control agents | `deepseek/deepseek-v4.1-flash` (`OPENROUTER_MODEL`) | `low` (`OPENROUTER_AGENT_REASONING`) |
| check | input guardrail, Dean | `openai/gpt-oss-120b` (`OPENROUTER_CHECK_MODEL`) | `low` (`OPENROUTER_CHECK_REASONING`) |

Requests go to the fastest providers first (`OPENROUTER_PROVIDER_SORT=throughput`)
that support structured output (`OPENROUTER_REQUIRE_PARAMETERS=True`).

**Leave these variables unset to use the defaults**, locally and on Railway. A
variable set in the environment overrides the default, and an empty one
(`OPENROUTER_MODEL=`) is an empty model name, not the default. At startup the
server logs the settings in use (`llm — agent=… check=…`), so a deploy log shows
what actually runs.

Set `OPENROUTER_ENABLED=False` (and supply `OPENAI_API_KEY`) to fall back to
OpenAI — no code changes needed.
