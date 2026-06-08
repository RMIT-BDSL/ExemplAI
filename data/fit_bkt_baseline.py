#!/usr/bin/env python3
"""
fit_bkt_baseline.py — Pre-train BKT baseline parameters from CSEDM 2019 data.

Reads the CSEDM 2019 Data Challenge dataset (ProgSnap2 format), maps each of
the 19 evaluated problems to a Knowledge Component (KC) based on the Python
concepts exercised, then fits a Bayesian Knowledge Tracing model using pyBKT.

The output is a JSON file (bktParams.json) containing the four BKT parameters
(prior, learn, guess, slip) for every KC, ready to be loaded by the live tutor.

Usage:
    python fit_bkt_baseline.py

Requirements (install with pip):
    pandas, pyBKT
"""

import json
import os
import sys
from pathlib import Path
import pandas as pd

try:
    from pyBKT.models import Model
except ImportError:
    print("ERROR: pyBKT is not installed. Install it with:")
    print("  pip install pyBKT")
    sys.exit(1)


# ---------------------------------------------------------------------------
# 1. Knowledge Component (KC) mapping
# ---------------------------------------------------------------------------
# Each of the 19 challenge problems is mapped to a KC representing the
# dominant Python concept it exercises.  Problems that share a KC are treated
# as repeated practice of the same underlying skill.
#
# KC taxonomy (7 components):
#   io_basics         — console I/O, type conversion, string formatting
#   arithmetic        — numeric operators, math expressions
#   conditionals      — if / elif / else, boolean logic
#   loops             — for / while iteration
#   string_manip      — slicing, concatenation, character tests
#   functions_params  — defining functions, parameters, return values
#   modular_arith     — modulo / integer division for real-world problems

PROBLEM_TO_KC = {
    # --- io_basics: basic I/O and type conversion ---
    "helloWorld":        "io_basics",        # print a greeting
    "intToFloat":        "io_basics",        # int ↔ float conversion
    "doubleX":           "io_basics",        # simple return of 2*x

    # --- arithmetic: numeric computation ---
    "raiseToPower":      "arithmetic",       # exponentiation
    "convertToDegrees":  "arithmetic",       # formula application

    # --- modular_arith: mod / integer division in context ---
    "leftoverCandy":     "modular_arith",    # modulo operator
    "howManyEggCartons": "modular_arith",    # ceiling division
    "kthDigit":          "modular_arith",    # digit extraction via mod/div
    "nearestBusStop":    "modular_arith",    # rounding with mod

    # --- conditionals: branching logic ---
    "hasTwoDigits":      "conditionals",     # range check with if
    "overNineThousand":  "conditionals",     # threshold comparison
    "canDrinkAlcohol":   "conditionals",     # age check
    "isEvenPositiveInt": "conditionals",     # compound boolean

    # --- functions_params: sqrt / math library usage ---
    "findRoot":          "functions_params", # math.sqrt, return value

    # --- string_manip: string slicing and character tests ---
    "isPunctuation":     "string_manip",     # character membership test
    "firstAndLast":      "string_manip",     # string slicing
    "backwardsCombine":  "string_manip",     # reverse + concatenate
    "singlePigLatin":    "string_manip",     # string manipulation

    # --- loops: iteration ---
    "oneToN":            "loops",            # for loop 1..n
}

# Friendly descriptions for the output JSON
KC_DESCRIPTIONS = {
    "io_basics":        "Console I/O, type conversion, simple returns",
    "arithmetic":       "Numeric operators and math expressions",
    "modular_arith":    "Modulo and integer division in context",
    "conditionals":     "If/elif/else branching and boolean logic",
    "functions_params": "Function definitions, parameters, library calls",
    "string_manip":     "String slicing, concatenation, character tests",
    "loops":            "For/while iteration",
}


# ---------------------------------------------------------------------------
# 2. Load and reshape the data for pyBKT
# ---------------------------------------------------------------------------

def load_predict_data(base_dir: Path) -> pd.DataFrame:
    """Load the full Predict.csv and add KC labels."""
    predict_path = base_dir / "Predict.csv"
    df = pd.read_csv(predict_path)

    # Map ProblemID → KC
    df["KC"] = df["ProblemID"].map(PROBLEM_TO_KC)

    # Drop any problems not in our KC map (shouldn't happen for the 19)
    unmapped = df[df["KC"].isna()]["ProblemID"].unique()
    if len(unmapped) > 0:
        print(f"  ⚠ Dropping {len(unmapped)} unmapped problems: {list(unmapped)}")
        df = df.dropna(subset=["KC"])

    return df


def prepare_pyBKT_input(df: pd.DataFrame) -> pd.DataFrame:
    """
    Reshape the prediction table into the format pyBKT expects:
        - user_id   : student identifier
        - skill_name: the KC
        - correct   : 1 if FirstCorrect else 0
        - order_id  : chronological ordering
    """
    bkt_df = pd.DataFrame({
        "user_id":    df["SubjectID"],
        "skill_name": df["KC"],
        "correct":    df["FirstCorrect"].map({True: 1, False: 0, "TRUE": 1, "FALSE": 0}),
        "order_id":   df["StartOrder"],
    })

    # pyBKT needs the data sorted by user then chronological order
    bkt_df = bkt_df.sort_values(["user_id", "order_id"]).reset_index(drop=True)

    return bkt_df


# ---------------------------------------------------------------------------
# 3. Fit the BKT model
# ---------------------------------------------------------------------------

def fit_bkt(bkt_df: pd.DataFrame) -> dict:
    """Fit a pyBKT model and return the learned parameters per KC."""
    model = Model(seed=42, num_fits=5)
    model.fit(data=bkt_df)

    params = model.params()
    return params


def extract_params(params: dict) -> dict:
    """
    Extract the four BKT parameters for each KC from pyBKT's output.

    pyBKT returns a nested dict like:
        params[skill_name] = {
            "prior": float,
            "learns": [float],
            "guesses": [float],
            "slips": [float],
            "forgets": [float],   # usually ~0
        }
    """
    result = {}
    for kc_name, kc_params in params.items():
        result[kc_name] = {
            "description": KC_DESCRIPTIONS.get(kc_name, ""),
            "prior":  round(float(kc_params["prior"]), 4),
            "learn":  round(float(kc_params["learns"][0]), 4),
            "guess":  round(float(kc_params["guesses"][0]), 4),
            "slip":   round(float(kc_params["slips"][0]), 4),
            "forget": round(float(kc_params.get("forgets", [0.0])[0]), 4),
        }
    return result


# ---------------------------------------------------------------------------
# 4. Main
# ---------------------------------------------------------------------------

def main():
    script_dir = Path(__file__).resolve().parent
    data_dir = script_dir / "csedm-2019"

    if not data_dir.exists():
        print(f"ERROR: Dataset directory not found at {data_dir}")
        sys.exit(1)

    print("=" * 60)
    print("  BKT Baseline Parameter Fitting — CSEDM 2019 Dataset")
    print("=" * 60)

    # --- Load data ---
    print("\n[1/4] Loading Predict.csv …")
    df = load_predict_data(data_dir)
    n_students = df["SubjectID"].nunique()
    n_problems = df["ProblemID"].nunique()
    n_kcs = df["KC"].nunique()
    print(f"  ✓ {len(df)} records | {n_students} students | "
          f"{n_problems} problems → {n_kcs} KCs")

    # --- Reshape for pyBKT ---
    print("\n[2/4] Preparing data for pyBKT …")
    bkt_df = prepare_pyBKT_input(df)
    print(f"  ✓ {len(bkt_df)} observation rows ready")

    # --- Fit ---
    print("\n[3/4] Fitting BKT model (this may take a minute) …")
    raw_params = fit_bkt(bkt_df)
    kc_params = extract_params(raw_params)

    # --- Print summary table ---
    print("\n" + "-" * 72)
    print(f"  {'KC':<20} {'Prior':>7} {'Learn':>7} {'Guess':>7} {'Slip':>7}")
    print("-" * 72)
    for kc, p in sorted(kc_params.items()):
        print(f"  {kc:<20} {p['prior']:>7.4f} {p['learn']:>7.4f} "
              f"{p['guess']:>7.4f} {p['slip']:>7.4f}")
    print("-" * 72)

    # --- Save ---
    out_path = script_dir / "bktParams.json"
    output = {
        "meta": {
            "source": "CSEDM 2019 Data Challenge (ProgSnap2)",
            "n_students": n_students,
            "n_problems": n_problems,
            "n_kcs": n_kcs,
            "n_observations": len(bkt_df),
            "fitting_library": "pyBKT",
        },
        "kc_parameters": kc_params,
    }

    print(f"\n[4/4] Writing parameters to {out_path.name} …")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"  ✓ Saved to {out_path}")

    print("\n✅ Done! These baseline parameters can now be loaded by the tutor.")


if __name__ == "__main__":
    main()
