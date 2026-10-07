"""Model and speed evaluation for the tutor graph (needs OPENROUTER_API_KEY in server/.env).

Runs the real tutor graph offline (no Convex, no browser) under different
OpenRouter setups and scores every reply automatically:

    cd server
    uv run --with pandas python -m eval.run speed             # time per reply, all setups
    uv run --with pandas python -m eval.run quality           # broader scenarios
    uv run --with pandas python -m eval.run dean              # Dean on planted good/bad drafts
    uv run --with pandas python -m eval.report                # tables from eval/out/

Setups live in eval/configs.py (model, provider order, reasoning effort per
role, output caps), cases in eval/cases.py, automatic checks in eval/checks.py.
Results go to eval/out/ (git-ignored). Spend is read from the OpenRouter key
before and after each phase; a phase stops when less than MIN_REMAINING_USD is
left on the key.
"""

import os

# The OpenAI fallback client (ai/llm/openai.py) is built at import and needs some key.
os.environ.setdefault("OPENAI_API_KEY", "unused")
