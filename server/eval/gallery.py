"""Render an examples run as one HTML page for reading every example.

    cd server
    uv run python -m eval.gallery eval/out/<run>-examples.jsonl eval/out/<run>-gallery.html
    uv run python -m eval.gallery B.jsonl page.html --compare "A=A.jsonl" "B=B.jsonl"   # with a comparison table

One card per example, in course order: the exercise, the student's failing
code and the failure summary the tutor was given, the example as the student
sees it (blanks and ??? prompts highlighted), the reply time, and the judge's
score and notes, with the judge's completed code folded away. Above the cards:
a summary per week and an index of every lesson. Plain HTML; the only script
filters and sorts.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import statistics
import sys
from datetime import datetime
from pathlib import Path

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import PythonLexer, TextLexer

from ai.syllabus import SYLLABUS
from eval.cases import OUT

TOPIC_NAMES = {"intro_setup": "Getting started", "variables_expressions": "Variables and expressions",
               "strings_formatting": "Strings and formatting", "branching": "Branching", "loops": "Loops",
               "advanced_loops": "Advanced loops", "functions": "Functions", "collections": "Collections",
               "files": "Files", "basic_libraries": "Libraries", "advanced_topics": "Advanced topics"}
NEW_FEATURES = {week: features for _, week, features in SYLLABUS}
AGENTS = {"complete_example_node", "faded_example_node", "erroneous_example_node"}

# ── A small Markdown renderer: the subset the tutor writes ────────────

_FENCE = re.compile(r"```[ \t]*([\w+-]*)[ \t]*\n(.*?)(?:```|\Z)", re.S)
_BLANK = re.compile(r"_{3,}")
_LOOKS_LIKE_PYTHON = re.compile(r"\b(def|return|print|if|for|while|import)\b|=")


def _blanks(s: str) -> str:
    return _BLANK.sub('<span class="blank">____</span>', s)


def code(src: str, lang: str = "python") -> str:
    src = src.rstrip("\n")
    python = lang.lower() in ("python", "py", "python3") or (not lang and _LOOKS_LIKE_PYTHON.search(src))
    body = highlight(src, PythonLexer() if python else TextLexer(), HtmlFormatter(nowrap=True)).rstrip("\n")
    body = _blanks(body)
    body = body.replace('<span class="c1"># ???', '<span class="c1 ask"># ???')
    body = body.replace('<span class="c1"># Step', '<span class="c1 step"># Step')
    return f'<pre class="code"><code>{body}</code></pre>'


def _inline(s: str) -> str:
    out = []
    for part in re.split(r"(`[^`\n]+`)", s):
        if len(part) > 1 and part.startswith("`") and part.endswith("`"):
            out.append(f"<code>{_blanks(html.escape(part[1:-1], quote=False))}</code>")
            continue
        part = html.escape(part, quote=False)
        part = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", part)
        part = re.sub(r"(?<![\w*])\*(?![\s*])(.+?)(?<![\s*])\*(?![\w*])", r"<em>\1</em>", part)
        out.append(_blanks(part))
    return "".join(out)


def _blocks(text: str) -> str:
    out: list[str] = []
    para: list[str] = []
    items: list[str] = []
    tag = ""

    def flush():
        nonlocal tag
        if para:
            out.append(f"<p>{' '.join(para)}</p>")
            para.clear()
        if items:
            out.append(f"<{tag}>" + "".join(f"<li>{i}</li>" for i in items) + f"</{tag}>")
            items.clear()
            tag = ""

    for line in text.split("\n"):
        stripped = line.strip()
        bullet = re.match(r"^[-*•]\s+(.*)", stripped)
        number = re.match(r"^\d+[.)]\s+(.*)", stripped)
        heading = re.match(r"^#{1,6}\s+(.*)", stripped)
        if not stripped or re.fullmatch(r"-{3,}|\*{3,}", stripped):
            flush()
        elif heading:
            flush()
            out.append(f'<p class="md-h">{_inline(heading.group(1))}</p>')
        elif bullet or number:
            want = "ul" if bullet else "ol"
            if para or (items and tag != want):
                flush()
            tag = want
            items.append(_inline((bullet or number).group(1)))
        elif items and line[:1] in (" ", "\t"):
            items[-1] += " " + _inline(stripped)
        else:
            if items:
                flush()
            para.append(_inline(stripped))
    flush()
    return "".join(out)


def md(text: str) -> str:
    out, pos = [], 0
    for m in _FENCE.finditer(text or ""):
        out.append(_blocks(text[pos:m.start()]))
        out.append(code(m.group(2), m.group(1)))
        pos = m.end()
    out.append(_blocks((text or "")[pos:]))
    return "".join(out)


# ── Page parts ────────────────────────────────────────────────────────

def _esc(s) -> str:
    return html.escape(str(s if s is not None else ""))


def _score_class(score) -> str:
    return "none" if not score else "bad" if score <= 2 else "warn" if score == 3 else "good"


def _pips(score) -> str:
    return "".join(f'<i class="{"on" if score and i <= score else ""}"></i>' for i in range(1, 6))


def _timing(steps: list) -> tuple[float, float]:
    """Seconds spent writing (the example agent, retries included) and checking (guardrail and Dean)."""
    writing = sum(s for n, s in steps if n in AGENTS)
    checks = sum(s for n, s in steps if n in ("input_guardrail", "dean_validation_node"))
    return writing, checks


def _chip(ok, good: str, bad: str, *, invert: bool = False, missing: str = "") -> str:
    if ok is None:
        return f'<li class="chip none">– {_esc(missing)}</li>' if missing else ""
    fine = (not ok) if invert else bool(ok)
    return f'<li class="chip {"ok" if fine else "bad"}">{"✓" if fine else "✕"} {_esc(good if fine else bad)}</li>'


def _note(on, text: str) -> str:
    return f'<li class="chip note">{_esc(text)}</li>' if on else ""


def _verdict_chips(r: dict) -> str:
    j, a = r["judge"], r["auto"]
    dean = a.get("dean")
    chips = [
        _chip(j.get("targets_student_error"), "Aims at the failure", "Misses the failure",
              missing="This mistake can't be targeted with a blank") if "targets_student_error" in j else "",
        _chip(j.get("blanks_well_placed"), "Blanks well placed", "Blanks misplaced"),
        # Recorded but acceptable for now (research team, 2026-10-08): shown as notes, not problems.
        _note(j.get("analogous_not_solution") is False, "Close to the exercise"),
        _note(j.get("hints_reveal_blank"), "Hints point to a blank"),
        _chip(j.get("follows_syllabus"), "Within the week's Python", "Uses later Python"),
        _chip(a.get("sample_ok") if a.get("sample_call") else None, "Sample output correct", "Sample output wrong",
              missing="No checkable sample call"),
    ]
    if a.get("filled_leak"):
        chips.append('<li class="chip bad">✕ Completed, it passes the exercise\'s tests</li>')
    if a.get("syllabus"):
        chips.append(f'<li class="chip bad">✕ Later Python: {_esc(", ".join(a["syllabus"]))}</li>')
    if dean and dean != "approved":
        chips.append(f'<li class="chip warn">Dean: {_esc(dean.replace("_", " "))}</li>')
    return "".join(c for c in chips if c)


def _anchor(r: dict) -> str:
    return r["lesson"] + (f"-{r['rep'] + 1}" if r.get("rep") else "")


def card(r: dict, lesson: dict, count_in_week: int, tries: int = 1) -> str:
    j, a = r["judge"], r["auto"]
    score = j.get("overall")
    steps = a.get("steps") if isinstance(a.get("steps"), list) else []
    writing, checks = _timing(steps)
    delivered = a.get("mode_delivered")
    reply_note = "as the student sees it" if delivered == r["kind"] else f"delivered as {delivered}, not scored"
    completed = j.get("completed_code") or ""
    if "```" in completed:
        completed = "\n".join(m.group(2) for m in _FENCE.finditer(completed))
    timing = (f'<p class="timing">Writing {writing:.1f} s · checks {checks:.1f} s'
              + (f' · {a["retries"]} retry after the Dean' if a.get("retries") else "") + "</p>") if steps else ""
    return f"""
<article class="card" id="{_esc(_anchor(r))}" data-week="{r['week']}" data-score="{score or 0}"
         data-time="{a['seconds']}" data-order="{lesson.get('position', 0) * 10 + r.get('rep', 0)}">
  <header class="card-head">
    <div class="card-title">
      <span class="eyebrow">Week {r['week']} · lesson {lesson.get('position', 0)} of {count_in_week}{f" · try {r.get('rep', 0) + 1} of {tries}" if tries > 1 else ""}</span>
      <h3>{_esc(r['lesson'])}</h3>
    </div>
    <div class="card-figures">
      <span class="score {_score_class(score)}" title="Judge's overall score">
        <b>{score if score else '–'}</b><small>/5</small><span class="pips">{_pips(score)}</span>
      </span>
      <span class="time" title="Get help round trip"><b>{a['seconds']:.1f}</b><small> s</small></span>
    </div>
  </header>
  <div class="card-body">
    <section class="context">
      <h4>Exercise</h4>
      <div class="prose">{md(lesson['problem_description'])}</div>
      <h4>Student's attempt <span class="note">{"simulated, with one typical mistake" if r.get("failure_kind") == "attempt" else "simulated: returns the first example's answer"}</span></h4>
      {code(r['student_code'])}
      {f'<p class="mistake"><b>The mistake</b> {_esc(r["mistake"])} <span class="muted">(known to the judge, not the tutor)</span></p>' if r.get("failure_kind") == "attempt" else ""}
      <h4>Failure summary the tutor was given</h4>
      <pre class="failure">{_esc(r['failure'])}</pre>
    </section>
    <section class="reply">
      <h4>Faded example <span class="note">{_esc(reply_note)}</span></h4>
      <div class="prose">{md(r['text'])}</div>
    </section>
  </div>
  <footer class="verdict">
    <ul class="chips">{_verdict_chips(r)}</ul>
    {f'<p class="notes"><b>Judge</b> {_esc(j.get("issues"))}</p>' if j.get("issues") else ""}
    {timing}
    {f'<details><summary>Judge’s completed version</summary>{code(completed)}</details>' if completed.strip() else ""}
  </footer>
</article>"""


def _pct(xs: list) -> str:
    known = [x for x in xs if x is not None]
    return f"{sum(1 for x in known if x)}/{len(known)}" if known else "–"


def _distribution(scores: list[int]) -> str:
    """Stacked bar of the 1-5 scores, each segment as wide as its count."""
    total = len(scores) or 1
    segs = []
    for s in range(1, 6):
        n = scores.count(s)
        if n:
            segs.append(f'<span class="seg s{s}" style="flex-grow:{n}" title="{n} scored {s}/5">'
                        f'{n if n / total >= 0.08 else ""}</span>')
    return f'<div class="dist" role="img" aria-label="Scores: ' + ", ".join(
        f"{scores.count(s)} scored {s}" for s in range(1, 6) if scores.count(s)) + f'">{"".join(segs)}</div>'


def week_summary(week: int, rows: list[dict], topic: str) -> str:
    scores = [r["judge"].get("overall") for r in rows if r["judge"].get("overall")]
    times = sorted(r["auto"]["seconds"] for r in rows)
    return f"""
<div class="week-sum">
  <div class="week-name"><b>Week {week}</b> {_esc(TOPIC_NAMES.get(topic, topic))} <span class="muted">· {len({r["lesson"] for r in rows})} lessons, {len(rows)} examples</span></div>
  <div class="figure"><b>{statistics.mean(scores):.1f}</b><small>/5 mean</small></div>
  {_distribution(scores)}
  <div class="figure"><b>{statistics.median(times):.1f}</b><small> s median</small></div>
  <div class="figure"><b>{times[-1]:.1f}</b><small> s slowest</small></div>
  <div class="facts">Aims at the failure {_pct([r['judge'].get('targets_student_error') for r in rows])} ·
    blanks well placed {_pct([r['judge'].get('blanks_well_placed') for r in rows])} ·
    sample output correct {_pct([r['auto'].get('sample_ok') for r in rows])}</div>
</div>"""


def _mark(ok, invert: bool = False) -> str:
    if ok is None:
        return '<td class="mark none">–</td>'
    fine = (not ok) if invert else bool(ok)
    return f'<td class="mark {"ok" if fine else "bad"}">{"✓" if fine else "✕"}</td>'


def index_row(r: dict, lesson: dict, tries: int = 1) -> str:
    j, a = r["judge"], r["auto"]
    score = j.get("overall")
    try_label = f' <span class="muted">try {r.get("rep", 0) + 1}</span>' if tries > 1 else ""
    return (f'<tr data-week="{r["week"]}" data-score="{score or 0}" data-time="{a["seconds"]}" '
            f'data-order="{r["week"] * 1000 + lesson.get("position", 0) * 10 + r.get("rep", 0)}">'
            f'<td><a href="#{_esc(_anchor(r))}">{_esc(r["lesson"])}</a>{try_label}</td><td class="num">{r["week"]}</td>'
            f'<td><span class="score mini {_score_class(score)}"><b>{score or "–"}</b><span class="pips">{_pips(score)}</span></span></td>'
            f'<td class="num">{a["seconds"]:.1f} s</td>'
            + _mark(j.get("targets_student_error")) + _mark(j.get("blanks_well_placed"))
            + _mark(a.get("sample_ok") if a.get("sample_call") else None) + "</tr>")


def _every_try(rows: list[dict], field: str) -> str:
    """Lessons where every try has the judge's field true, out of all lessons."""
    by: dict[str, list] = {}
    for r in rows:
        by.setdefault(r["lesson"], []).append(r["judge"].get(field))
    return f"{sum(1 for v in by.values() if all(v))}/{len(by)}"


def comparison(arms: list[tuple[str, list[dict]]], shown: str) -> str:
    """Runs of the same lessons and failures side by side: one row per run."""
    body = []
    for label, rows in arms:
        times = sorted(r["auto"]["seconds"] for r in rows)
        scores = [r["judge"].get("overall") for r in rows if r["judge"].get("overall")]
        body.append(
            f'<tr class="{"shown" if label == shown else ""}"><th scope="row">{_esc(label)}</th>'
            f'<td><code>{_esc(rows[0].get("prompt", "?"))}</code></td><td>{_esc(rows[0].get("reasoning") or "low")}</td>'
            f'<td class="num">{len(rows)}</td><td class="num">{statistics.mean(scores):.2f}</td>'
            f'<td class="num">{_pct([r["judge"].get("blanks_well_placed") for r in rows])}</td>'
            f'<td class="num">{_every_try(rows, "blanks_well_placed")}</td>'
            f'<td class="num">{_pct([r["judge"].get("hints_reveal_blank") for r in rows])}</td>'
            f'<td class="num">{_pct([r["judge"].get("analogous_not_solution") for r in rows])}</td>'
            f'<td class="num">{statistics.median(times):.1f} s</td><td class="num">{times[int(0.9 * len(times)) - 1]:.1f} s</td></tr>')
    return f"""
<section class="compare" aria-labelledby="compare-h">
  <h2 id="compare-h">Versions compared on the same lessons and mistakes</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>Version</th><th>Faded prompt</th><th>Reasoning</th><th>Examples</th><th>Mean score</th>
      <th>Blanks well placed</th><th>Lessons placed well every try</th><th>Hints give a blank away</th>
      <th>Different task</th><th>Median reply</th><th>90th percentile</th></tr></thead>
    <tbody>{"".join(body)}</tbody>
  </table></div>
  <p class="muted">The cards below are from <b>{_esc(shown)}</b>.</p>
</section>"""


def page(rows: list[dict], lessons: dict, source: str, arms: list[tuple[str, list[dict]]] | None = None,
         shown: str = "") -> str:
    order = lambda r: (r["week"], lessons[r["lesson"]].get("position", 0), r.get("rep", 0))
    rows = sorted(rows, key=order)
    tries = max(r.get("rep", 0) for r in rows) + 1
    weeks = sorted({r["week"] for r in rows})
    by_week = {w: [r for r in rows if r["week"] == w] for w in weeks}
    count = {w: len({r["lesson"] for r in by_week[w]}) for w in weeks}
    n_lessons = len({r["lesson"] for r in rows})
    all_scores = [r["judge"].get("overall") for r in rows if r["judge"].get("overall")]
    times = sorted(r["auto"]["seconds"] for r in rows)
    kind = rows[0]["kind"].capitalize()
    week_label = f"weeks {weeks[0]}–{weeks[-1]}" if len(weeks) > 1 else f"week {weeks[0]}"
    lessons_text = f"{n_lessons} lessons" + (f" ({tries} tries each)" if tries > 1 else "")
    if rows[0].get("failure_kind") == "attempt":
        lead = (f"For each of the {lessons_text}, a simulated student submitted a realistic attempt with one typical "
                "mistake, then pressed Get help at mastery 0.5, so the tutor wrote a Faded example.")
    else:
        lead = (f"For each of the {lessons_text}, a simulated student failed Submit and pressed Get help at mastery "
                "0.5, so the tutor wrote a Faded example.")
    sections = []
    for w in weeks:
        topic = lessons[by_week[w][0]["lesson"]].get("knowledge_component", "")
        cards = "".join(card(r, lessons[r["lesson"]], count[w], tries) for r in by_week[w])
        sections.append(f"""
<section class="week" data-week="{w}" aria-labelledby="w{w}">
  <div class="week-head">
    <h2 id="w{w}">Week {w} · {_esc(TOPIC_NAMES.get(topic, topic))}</h2>
    <p class="muted">New Python this week: {_esc(NEW_FEATURES.get(w, ""))}</p>
  </div>
  {cards}
</section>""")
    week_buttons = "".join(f'<button type="button" data-week="{w}" aria-pressed="false">{w}</button>' for w in weeks)
    every = (f'<div><b>{_every_try(rows, "blanks_well_placed")}</b> lessons placed well every try</div>'
             if tries > 1 else "")
    return TEMPLATE.format(
        title=f"{kind} Examples " + (f"Weeks {weeks[0]}–{weeks[-1]}" if len(weeks) > 1 else f"Week {weeks[0]}"),
        heading=f"{kind} examples, {week_label}", lead=lead, n=len(rows),
        mean=f"{statistics.mean(all_scores):.1f}", median=f"{statistics.median(times):.1f}", slowest=f"{times[-1]:.1f}",
        aims=_pct([r["judge"].get("targets_student_error") for r in rows]),
        blanks=_pct([r["judge"].get("blanks_well_placed") for r in rows]), every=every,
        sample=_pct([r["auto"].get("sample_ok") for r in rows]),
        passes=sum(1 for r in rows if r["auto"].get("filled_leak")),
        summaries="".join(week_summary(w, by_week[w], lessons[by_week[w][0]["lesson"]].get("knowledge_component", ""))
                          for w in weeks),
        comparison=comparison(arms, shown) if arms else "",
        index_rows="".join(index_row(r, lessons[r["lesson"]], tries) for r in rows),
        week_buttons=week_buttons, sections="".join(sections), prompt=_esc(rows[0].get("prompt", "?")),
        reasoning=_esc(rows[0].get("reasoning") or "low"), source=_esc(source),
        judge=_esc(rows[0].get("judge_model") or "Claude Sonnet 5.5"),
        date=datetime.fromtimestamp(Path(source).stat().st_mtime).strftime("%-d %B %Y") if Path(source).exists() else "",
    )


TEMPLATE = """<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
/* Layout: a marking sheet. Summary and index first, then one card per lesson in course order:
   the exercise and the student's failure on the left, the tutor's faded example on the right. */
:root {{
  --paper: #f3f5f7; --sheet: #ffffff; --ink: #18212b; --muted: #5b6776; --rule: #dce2e9;
  --accent: #23579a; --code-bg: #f4f6f9; --blank-bg: #ffe27a; --blank-ink: #3f3200;
  --good: #2a7548; --warn: #9a640a; --bad: #b0372c;
  --good-bg: #e3f2e8; --warn-bg: #fbefd9; --bad-bg: #f8e1de;
  --s1: #b0372c; --s2: #df8a7f; --s3: #e0b04f; --s4: #79bd91; --s5: #2a7548;
  --s1-ink: #ffffff; --s2-ink: #3a0f0a; --s3-ink: #2b2000; --s4-ink: #0d2a18; --s5-ink: #ffffff;
  --shadow: rgba(16, 24, 40, 0.35);
  --syn-kw: #7a3d9f; --syn-str: #2a7548; --syn-num: #a2500b; --syn-com: #6a7483;
  --syn-fn: #23579a; --syn-builtin: #0e6f84; --syn-ask: #8a4a00;
  --font-display: "IBM Plex Sans Condensed", "IBM Plex Sans", system-ui, sans-serif;
  --font-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --paper: #101317; --sheet: #171b21; --ink: #e2e7ee; --muted: #98a3b1; --rule: #29303a;
  --accent: #8fb5ec; --code-bg: #12161b; --blank-bg: #6b5512; --blank-ink: #ffeaa8;
  --good: #79cc98; --warn: #e6b65c; --bad: #f28c80;
  --good-bg: #17331f; --warn-bg: #382b12; --bad-bg: #3c1c19;
  --s1: #e3675a; --s2: #a95349; --s3: #b98a33; --s4: #3f8a5c; --s5: #79cc98;
  --s1-ink: #1a0503; --s2-ink: #ffffff; --s3-ink: #1f1600; --s4-ink: #ffffff; --s5-ink: #0b2615;
  --shadow: rgba(0, 0, 0, 0.6);
  --syn-kw: #c9a3f2; --syn-str: #9fd8a9; --syn-num: #f1b27a; --syn-com: #8a95a4;
  --syn-fn: #8fb5ec; --syn-builtin: #6fcfe0; --syn-ask: #ffc56a; color-scheme: dark;
}} }}
:root[data-theme="dark"] {{
  --paper: #101317; --sheet: #171b21; --ink: #e2e7ee; --muted: #98a3b1; --rule: #29303a;
  --accent: #8fb5ec; --code-bg: #12161b; --blank-bg: #6b5512; --blank-ink: #ffeaa8;
  --good: #79cc98; --warn: #e6b65c; --bad: #f28c80;
  --good-bg: #17331f; --warn-bg: #382b12; --bad-bg: #3c1c19;
  --s1: #e3675a; --s2: #a95349; --s3: #b98a33; --s4: #3f8a5c; --s5: #79cc98;
  --s1-ink: #1a0503; --s2-ink: #ffffff; --s3-ink: #1f1600; --s4-ink: #ffffff; --s5-ink: #0b2615;
  --shadow: rgba(0, 0, 0, 0.6);
  --syn-kw: #c9a3f2; --syn-str: #9fd8a9; --syn-num: #f1b27a; --syn-com: #8a95a4;
  --syn-fn: #8fb5ec; --syn-builtin: #6fcfe0; --syn-ask: #ffc56a; color-scheme: dark;
}}
* {{ box-sizing: border-box; }}
body {{ background: var(--paper); color: var(--ink); font: 15px/1.55 var(--font-body); padding: 0 16px; margin: 0; }}
.wrap {{ max-width: 1240px; margin: 0 auto; padding-block: 36px 64px; display: grid; gap: 28px; }}
h1, h2, h3 {{ font-family: var(--font-display); text-wrap: balance; margin: 0; }}
h1 {{ font-size: clamp(28px, 4vw, 40px); font-weight: 600; letter-spacing: -0.01em; }}
h2 {{ font-size: 24px; font-weight: 600; }}
h3 {{ font-size: 21px; font-weight: 600; font-family: var(--font-mono); letter-spacing: -0.02em; }}
h4 {{ margin: 0; font: 600 11.5px/1.3 var(--font-body); text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }}
a {{ color: var(--accent); }}
a:focus-visible, button:focus-visible, summary:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
.muted {{ color: var(--muted); }}
.note {{ text-transform: none; letter-spacing: 0; font-weight: 400; }}
code, pre {{ font-family: var(--font-mono); }}

/* Masthead */
.masthead {{ display: grid; gap: 12px; }}
.masthead .lead {{ max-width: 72ch; margin: 0; color: var(--ink); }}
.meta {{ display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; font-size: 13px; color: var(--muted); }}
.meta b {{ color: var(--ink); font-weight: 500; }}
.headline {{ display: flex; flex-wrap: wrap; gap: 10px 28px; align-items: baseline; padding-top: 6px; }}
.headline div {{ display: flex; align-items: baseline; gap: 6px; font-size: 13px; color: var(--muted); }}
.headline b {{ font: 600 26px/1 var(--font-display); color: var(--ink); font-variant-numeric: tabular-nums; }}

/* Week summaries */
.summary {{ display: grid; gap: 10px; }}
.week-sum {{ display: grid; grid-template-columns: minmax(180px, 1.3fr) auto minmax(140px, 1.6fr) auto auto; gap: 8px 22px;
  align-items: center; background: var(--sheet); border: 1px solid var(--rule); border-radius: 10px; padding: 14px 18px; }}
.week-sum .week-name b {{ font-family: var(--font-display); font-size: 17px; margin-right: 4px; }}
.week-sum .figure {{ display: flex; align-items: baseline; gap: 4px; white-space: nowrap; font-variant-numeric: tabular-nums; }}
.week-sum .figure b {{ font: 600 22px/1 var(--font-display); }}
.week-sum .figure small {{ color: var(--muted); font-size: 12.5px; }}
.week-sum .facts {{ grid-column: 1 / -1; font-size: 13px; color: var(--muted); }}
.dist {{ display: flex; height: 20px; border-radius: 4px; overflow: hidden; min-width: 0; }}
.dist .seg {{ display: grid; place-items: center; font: 600 11.5px/1 var(--font-mono); min-width: 6px; }}
.dist .s1 {{ background: var(--s1); color: var(--s1-ink); }} .dist .s2 {{ background: var(--s2); color: var(--s2-ink); }}
.dist .s3 {{ background: var(--s3); color: var(--s3-ink); }} .dist .s4 {{ background: var(--s4); color: var(--s4-ink); }}
.dist .s5 {{ background: var(--s5); color: var(--s5-ink); }}
.legend {{ display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--muted); margin: 0; padding: 0; list-style: none; }}
.legend li {{ display: flex; align-items: center; gap: 6px; }}
.legend i {{ width: 12px; height: 12px; border-radius: 3px; display: inline-block; }}

/* Comparison */
.compare {{ display: grid; gap: 10px; background: var(--sheet); border: 1px solid var(--rule); border-radius: 10px; padding: 16px 18px; }}
.compare h2 {{ font-size: 19px; }}
.compare p {{ margin: 0; font-size: 13px; }}
.compare tbody th {{ text-align: left; font: 600 13.5px/1.3 var(--font-body); text-transform: none; letter-spacing: 0; color: var(--ink); }}
.compare tr.shown {{ background: color-mix(in srgb, var(--accent) 9%, var(--sheet)); }}
.mistake {{ margin: 0; font-size: 13.5px; }}
.mistake b {{ font: 600 11.5px/1 var(--font-body); text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin-right: 6px; }}

/* Controls */
.controls {{ position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; flex-wrap: wrap; gap: 10px 22px;
  align-items: center; padding: 10px 14px; background: var(--sheet); border: 1px solid var(--rule); border-radius: 10px;
  box-shadow: 0 6px 18px -14px var(--shadow); font-size: 13.5px; }}
.controls fieldset {{ border: 0; margin: 0; padding: 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }}
.controls legend {{ float: left; margin-right: 6px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; font-weight: 600; }}
.controls button {{ font: 500 13.5px/1 var(--font-body); color: var(--ink); background: transparent; border: 1px solid var(--rule);
  border-radius: 999px; padding: 6px 11px; cursor: pointer; }}
.controls button[aria-pressed="true"] {{ background: var(--ink); color: var(--sheet); border-color: var(--ink); }}
.controls .count {{ margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }}

/* Index */
.index {{ background: var(--sheet); border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; }}
.index summary {{ cursor: pointer; padding: 12px 16px; font-weight: 600; }}
.table-scroll {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; padding: 7px 12px; border-top: 1px solid var(--rule); white-space: nowrap; }}
th {{ font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 600; }}
td a {{ font-family: var(--font-mono); text-decoration: none; }}
td a:hover {{ text-decoration: underline; }}
td.num {{ text-align: right; }}
td.mark {{ text-align: center; font-weight: 600; }}
.mark.ok {{ color: var(--good); }} .mark.bad {{ color: var(--bad); }} .mark.none {{ color: var(--muted); }}

/* Score and time */
.score {{ display: inline-flex; align-items: baseline; gap: 2px; font-variant-numeric: tabular-nums; }}
.score b {{ font: 600 26px/1 var(--font-display); }}
.score small {{ color: var(--muted); font-size: 13px; }}
.score .pips {{ display: inline-flex; gap: 3px; margin-left: 8px; align-self: center; }}
.score .pips i {{ width: 9px; height: 9px; border-radius: 2px; background: var(--rule); }}
.score.good b {{ color: var(--good); }} .score.good .pips i.on {{ background: var(--good); }}
.score.warn b {{ color: var(--warn); }} .score.warn .pips i.on {{ background: var(--warn); }}
.score.bad b {{ color: var(--bad); }} .score.bad .pips i.on {{ background: var(--bad); }}
.score.mini b {{ font-size: 15px; }}
.score.mini .pips {{ margin-left: 6px; }} .score.mini .pips i {{ width: 7px; height: 7px; }}
.time b {{ font: 600 22px/1 var(--font-display); font-variant-numeric: tabular-nums; }}
.time small {{ color: var(--muted); }}

/* Week sections and cards */
.week {{ display: grid; gap: 18px; }}
.week-head {{ display: grid; gap: 2px; border-bottom: 2px solid var(--ink); padding-bottom: 8px; margin-top: 12px; }}
.week-head p {{ margin: 0; font-size: 13.5px; }}
.card {{ background: var(--sheet); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; scroll-margin-top: 80px; }}
.card-head {{ display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 10px 24px;
  padding: 16px 20px 12px; border-bottom: 1px solid var(--rule); }}
.card-title {{ display: grid; gap: 3px; min-width: 0; }}
.eyebrow {{ font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; font-weight: 600; }}
.card-figures {{ display: flex; align-items: baseline; gap: 22px; }}
.card-body {{ display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }}
.context, .reply {{ padding: 16px 20px; display: grid; gap: 10px; align-content: start; min-width: 0; }}
.context {{ border-right: 1px solid var(--rule); background: color-mix(in srgb, var(--paper) 45%, var(--sheet)); }}
.context h4:not(:first-child) {{ margin-top: 8px; }}
.prose {{ min-width: 0; }}
.prose p {{ margin: 0 0 10px; max-width: 70ch; }}
.prose p:last-child {{ margin-bottom: 0; }}
.prose .md-h {{ font-weight: 600; }}
.prose ul, .prose ol {{ margin: 0 0 10px; padding-left: 22px; }}
.prose code {{ font-size: .9em; background: var(--code-bg); border: 1px solid var(--rule); border-radius: 4px; padding: 0 4px; }}
pre.code {{ margin: 0 0 10px; background: var(--code-bg); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px;
  overflow-x: auto; font-size: 13.4px; line-height: 1.6; tab-size: 4; }}
pre.code code {{ background: none; border: 0; padding: 0; font-size: inherit; }}
pre.failure {{ margin: 0; font-size: 12.8px; line-height: 1.5; white-space: pre-wrap; color: var(--ink);
  background: var(--sheet); border: 1px dashed var(--rule); border-radius: 8px; padding: 10px 12px; }}
.blank {{ background: var(--blank-bg); color: var(--blank-ink); border-radius: 3px; padding: 0 2px; font-weight: 600; }}
.k, .kc, .kn, .ow {{ color: var(--syn-kw); }} .nb, .bp {{ color: var(--syn-builtin); }} .nf, .fm {{ color: var(--syn-fn); }}
.s, .s1, .s2, .sa, .sd, .se, .si {{ color: var(--syn-str); }} .mi, .mf, .mh, .mo {{ color: var(--syn-num); }}
.c, .c1, .cm {{ color: var(--syn-com); font-style: italic; }}
.c1.step {{ font-style: normal; font-weight: 500; }}
.c1.ask {{ color: var(--syn-ask); font-style: normal; font-weight: 500; }}

/* Verdict */
.verdict {{ border-top: 1px solid var(--rule); padding: 14px 20px 16px; display: grid; gap: 10px; }}
.chips {{ display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }}
.chip {{ font-size: 12.5px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--rule); color: var(--muted); }}
.chip.bad {{ background: var(--bad-bg); color: var(--bad); border-color: transparent; font-weight: 500; }}
.chip.note {{ border-style: dashed; }}
.chip.warn {{ background: var(--warn-bg); color: var(--warn); border-color: transparent; font-weight: 500; }}
.notes {{ margin: 0; max-width: 100ch; font-size: 14px; }}
.notes b {{ font: 600 11.5px/1 var(--font-body); text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin-right: 6px; }}
.timing {{ margin: 0; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }}
details summary {{ cursor: pointer; font-size: 13px; color: var(--accent); }}
details[open] summary {{ margin-bottom: 8px; }}

@media (max-width: 900px) {{
  .card-body {{ grid-template-columns: minmax(0, 1fr); }}
  .context {{ border-right: 0; border-bottom: 1px solid var(--rule); }}
  .week-sum {{ grid-template-columns: 1fr auto auto; }}
  .week-sum .week-name, .week-sum .dist {{ grid-column: 1 / -1; }}
}}
@media (max-width: 520px) {{
  .controls .count {{ margin-left: 0; }}
  .card-head, .context, .reply, .verdict {{ padding-left: 14px; padding-right: 14px; }}
}}
@media (prefers-reduced-motion: no-preference) {{ html {{ scroll-behavior: smooth; }} }}
</style>

<div class="wrap">
  <header class="masthead">
    <h1>{heading}</h1>
    <p class="lead">{lead} Times are the whole Get help round trip (guardrail, tutor, Dean), one request at a time.
      Scores reward an example that aims at the student's failure where a blank can; being close to the exercise
      and hints that point to a blank are noted, not marked down.</p>
    <ul class="meta">
      <li>Run <b>{date}</b></li>
      <li>Tutor <b>DeepSeek V4.1 Flash</b>, reasoning low</li>
      <li>Guardrail and Dean <b>gpt-oss-120b</b></li>
      <li>Judge <b>{judge}</b></li>
      <li>Faded prompt <b>{prompt}</b>, reasoning <b>{reasoning}</b></li>
    </ul>
    <div class="headline">
      <div><b>{mean}</b>/5 mean score</div>
      <div><b>{median}</b> s median reply</div>
      <div><b>{slowest}</b> s slowest</div>
      <div><b>{aims}</b> aim at the failure (where it can be targeted)</div>
      <div><b>{blanks}</b> blanks well placed</div>
      {every}
      <div><b>{sample}</b> sample output correct</div>
      <div><b>{passes}</b> solve the exercise once completed</div>
    </div>
  </header>

  {comparison}

  <section class="summary" aria-label="Summary by week">
    {summaries}
    <ul class="legend" aria-label="Score colours">
      <li><i style="background:var(--s1)"></i>1</li><li><i style="background:var(--s2)"></i>2</li>
      <li><i style="background:var(--s3)"></i>3</li><li><i style="background:var(--s4)"></i>4</li>
      <li><i style="background:var(--s5)"></i>5</li>
    </ul>
  </section>

  <div class="controls" role="region" aria-label="Filter and sort">
    <fieldset id="f-week"><legend>Week</legend><button type="button" data-week="all" aria-pressed="true">All</button>{week_buttons}</fieldset>
    <fieldset id="f-score"><legend>Score</legend>
      <button type="button" data-score="all" aria-pressed="true">All</button>
      <button type="button" data-score="low" aria-pressed="false">1–2</button>
      <button type="button" data-score="mid" aria-pressed="false">3</button>
      <button type="button" data-score="high" aria-pressed="false">4–5</button>
    </fieldset>
    <fieldset id="f-sort"><legend>Sort</legend>
      <button type="button" data-sort="order" aria-pressed="true">Course order</button>
      <button type="button" data-sort="score" aria-pressed="false">Lowest score</button>
      <button type="button" data-sort="time" aria-pressed="false">Slowest</button>
    </fieldset>
    <span class="count" id="count">{n} of {n} shown</span>
  </div>

  <details class="index" open>
    <summary>Every lesson at a glance</summary>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Lesson</th><th>Week</th><th>Score</th><th>Time</th><th>Aims at failure</th>
          <th>Blanks placed</th><th>Sample output</th></tr></thead>
        <tbody id="index-rows">{index_rows}</tbody>
      </table>
    </div>
  </details>

  {sections}

  <p class="muted" style="font-size:12.5px;margin:0">Source: <code>{source}</code></p>
</div>

<script>
(() => {{
  const state = {{ week: "all", score: "all", sort: "order" }};
  try {{ Object.assign(state, JSON.parse(localStorage.getItem("gallery-view") || "{{}}")); }} catch (e) {{}}
  const inScore = (s) => state.score === "all" || (state.score === "low" ? s >= 1 && s <= 2 : state.score === "mid" ? s === 3 : s >= 4);
  const key = (el) => state.sort === "score" ? +el.dataset.score : state.sort === "time" ? -el.dataset.time : +el.dataset.order;
  function apply() {{
    let shown = 0;
    document.querySelectorAll(".week").forEach((sec) => {{
      const cards = [...sec.querySelectorAll(".card")];
      cards.sort((a, b) => key(a) - key(b)).forEach((c) => sec.appendChild(c));
      let any = false;
      cards.forEach((c) => {{
        const show = (state.week === "all" || c.dataset.week === state.week) && inScore(+c.dataset.score);
        c.hidden = !show; any = any || show; if (show) shown++;
      }});
      sec.hidden = !any;
    }});
    const body = document.getElementById("index-rows");
    const rows = [...body.querySelectorAll("tr")];
    rows.sort((a, b) => key(a) - key(b)).forEach((r) => body.appendChild(r));
    rows.forEach((r) => {{ r.hidden = !((state.week === "all" || r.dataset.week === state.week) && inScore(+r.dataset.score)); }});
    document.getElementById("count").textContent = shown + " of {n} shown";
    for (const [id, attr] of [["f-week", "week"], ["f-score", "score"], ["f-sort", "sort"]]) {{
      document.querySelectorAll("#" + id + " button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === state[attr])));
    }}
    try {{ localStorage.setItem("gallery-view", JSON.stringify(state)); }} catch (e) {{}}
  }}
  for (const [id, attr] of [["f-week", "week"], ["f-score", "score"], ["f-sort", "sort"]]) {{
    document.getElementById(id).addEventListener("click", (e) => {{
      const b = e.target.closest("button"); if (!b) return; state[attr] = b.dataset[attr]; apply();
    }});
  }}
  apply();
}})();
</script>
"""


def _load(path: str) -> list[dict]:
    rows = [json.loads(l) for l in Path(path).read_text().splitlines() if l.strip()]
    return [r for r in rows if r.get("kind") in ("faded", "erroneous")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="the run whose examples the cards show (*-examples.jsonl)")
    ap.add_argument("target", help="the HTML file to write")
    ap.add_argument("--compare", nargs="*", default=[], metavar="LABEL=FILE",
                    help="runs to compare in a table at the top; the one whose FILE is source is the shown run")
    args = ap.parse_args()
    lessons = json.loads((OUT / "lessons.json").read_text())
    arms = [(label, _load(path)) for label, path in (c.rsplit("=", 1) for c in args.compare)]
    shown = next((label for label, path in (c.rsplit("=", 1) for c in args.compare)
                  if Path(path).resolve() == Path(args.source).resolve()), "")
    rows = _load(args.source)
    Path(args.target).write_text(page(rows, lessons, args.source, arms, shown))
    print(f"wrote {args.target} ({len(rows)} examples)")


if __name__ == "__main__":
    main()
