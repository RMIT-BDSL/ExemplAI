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

The agent uses OpenAI by default (set `OPENAI_API_KEY` in `server/.env`). It can
also be driven through **OpenRouter**, which is available as an additional route
behind OpenAI for every agent node but is **inactive by default**:

1. Create an API key at https://openrouter.ai and copy it.
2. In `server/.env`, set:
   ```
   OPENROUTER_API_KEY=<your key>
   OPENROUTER_MODEL=            # optional; defaults to deepseek/deepseek-v4-flash-0731
   OPENROUTER_ENABLED=True
   ```
3. Restart the server. With `OPENROUTER_ENABLED=True` every agent node routes
   through the OpenRouter model; set it back to `False` (or remove the key) to
   revert to OpenAI with no code changes.
