"""Summarise eval runs: uv run --with pandas python -m eval.report [files...] (default: latest of each phase)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx
import pandas as pd

from eval.cases import OUT

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 30)


def _latest(phase: str) -> Path | None:
    files = sorted(OUT.glob(f"*-{phase}.jsonl"))
    return files[-1] if files else None


def _load(path: Path) -> pd.DataFrame:
    return pd.DataFrame([json.loads(line) for line in path.read_text().splitlines() if line.strip()])


def _prices() -> dict[str, tuple[float, float]]:
    cache = OUT / "prices.json"
    if not cache.exists():
        data = httpx.get("https://openrouter.ai/api/v1/models", timeout=30).json()["data"]
        cache.write_text(json.dumps({m["id"]: (float(m["pricing"]["prompt"]), float(m["pricing"]["completion"]))
                                     for m in data if m.get("pricing")}))
    return json.loads(cache.read_text())


def _cost(calls: list[dict], prices: dict) -> float:
    total = 0.0
    for c in calls:
        model = c.get("model") or ""
        p = prices.get(model) or next((v for k, v in prices.items() if model.startswith(k)), None)
        if p and c.get("in") is not None:
            total += c["in"] * p[0] + (c.get("out") or 0) * p[1]
    return total


def _step(steps, names) -> float:
    return sum(s for n, s in steps if n in names)


AGENTS = {"complete_example_node", "faded_example_node", "erroneous_example_node", "control_agent_node"}


def replies(df: pd.DataFrame) -> pd.DataFrame:
    prices = _prices()
    df = df.copy()
    df["agent_s"] = df["steps"].apply(lambda s: _step(s, AGENTS))
    df["dean_s"] = df["steps"].apply(lambda s: _step(s, {"dean_validation_node"}))
    df["guard_s"] = df["steps"].apply(lambda s: _step(s, {"input_guardrail"}))
    df["reasoning"] = df["calls"].apply(lambda cs: sum(c.get("reasoning") or 0 for c in cs))
    df["cost_usd"] = df["calls"].apply(lambda cs: _cost(cs, prices))
    df["leak"] = df["checks"].apply(lambda c: c["leak"])
    df["syllabus"] = df["checks"].apply(lambda c: bool(c["syllabus"]))
    df["structure"] = df["checks"].apply(lambda c: bool(c["structure"]))
    df["quotes_code"] = df["checks"].apply(lambda c: c["quotes_student_code"])
    df["fallback"] = df["dean"].isin(["rejected"])
    df["failed"] = df["error"].notna() | (df["text"].fillna("") == "")
    return df


def speed_table(df: pd.DataFrame) -> pd.DataFrame:
    g = df.groupby("config")
    t = pd.DataFrame({
        "n": g.size(),
        "p50_s": g["total_s"].median(),
        "p90_s": g["total_s"].quantile(0.9),
        "p95_s": g["total_s"].quantile(0.95),
        "max_s": g["total_s"].max(),
        ">15s": g["total_s"].apply(lambda s: (s > 15).mean()),
        ">60s": g["total_s"].apply(lambda s: (s > 60).mean()),
        "agent_p50": g["agent_s"].median(),
        "dean_p50": g["dean_s"].median(),
        "retry": g["retries"].apply(lambda s: (s > 0).mean()),
        "fallback": g["fallback"].mean(),
        "failed": g["failed"].mean(),
        "reason_tok": g["reasoning"].mean(),
        "cost_c": g["cost_usd"].mean() * 100,
        "leaks": g["leak"].sum(),
        "syllabus": g["syllabus"].mean(),
        "structure": g["structure"].mean(),
    })
    return t.sort_values("p50_s").round(2)


def by_mode(df: pd.DataFrame) -> pd.DataFrame:
    return df.pivot_table(index="config", columns="mode", values="total_s", aggfunc="median").round(1)


def quality_table(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for config, d in df.groupby("config"):
        ex = d[d["scenario"].isin(["get_help", "new_example"])]
        typed = d[d["scenario"].isin(["give_answer", "fix_my_code", "injection", "follow_up"])]
        rows.append({
            "config": config, "n": len(d), "p50_s": d["total_s"].median(), "p95_s": d["total_s"].quantile(0.95),
            "leaks": int(d["leak"].sum()), "leaks_typed+control": int(d[d["scenario"] != "get_help"]["leak"].sum()),
            "syllabus": round(ex["syllabus"].mean(), 2), "structure": round(ex["structure"].mean(), 2),
            "quotes_code": int(d["quotes_code"].sum()),
            "new_ex_similar>0.8": int((d.get("similarity_to_first", pd.Series(dtype=float)).fillna(0) > 0.8).sum()),
            "injection_blocked": f"{int((d[d['scenario'] == 'injection']['guardrail_passed'] == False).sum())}/"
                                 f"{int((d['scenario'] == 'injection').sum())}",
            "typed_new_example": int((typed["response_type"] == "new_example").sum()),
            "fallback": round(d["fallback"].mean(), 2), "failed": int(d["failed"].sum()),
            "cost_c": round(d["cost_usd"].mean() * 100, 3),
        })
    return pd.DataFrame(rows).set_index("config").sort_values("p50_s")


def dean_table(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["correct"] = df["decision"] == df["expect"]
    t = df.pivot_table(index="config", columns="variant", values="correct", aggfunc="mean").round(2)
    t["p50_s"] = df.groupby("config")["s"].median().round(2)
    t["errors"] = df.groupby("config")["error"].apply(lambda s: s.notna().sum())
    return t


def main():
    files = [Path(a) for a in sys.argv[1:]] or [p for p in (_latest("speed"), _latest("quality"), _latest("dean"),
                                                            _latest("session")) if p]
    for path in files:
        df = _load(path)
        print(f"\n{'═' * 100}\n{path.name}  ({len(df)} rows)\n{'═' * 100}")
        if path.name.endswith("-speed.jsonl"):
            df = replies(df)
            print(speed_table(df).to_string())
            print("\nMedian seconds by example type:")
            print(by_mode(df).to_string())
        elif path.name.endswith("-quality.jsonl"):
            df = replies(df)
            print(quality_table(df).to_string())
        elif path.name.endswith("-session.jsonl"):
            from eval.session import summary
            summary(df.to_dict("records"))
        elif path.name.endswith("-dean.jsonl"):
            print("Share of planted drafts the Dean judged correctly (clean = approved, others = rejected):")
            print(dean_table(df).to_string())


if __name__ == "__main__":
    main()
