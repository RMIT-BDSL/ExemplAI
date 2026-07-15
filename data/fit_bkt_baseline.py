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

# Monkeypatch scikit-learn metrics submodules to handle list inputs, bypassing a pyBKT import bug in newer sklearn versions
try:
    import numpy as np
    import re
    import sklearn.metrics._regression
    import sklearn.metrics._classification
    def _make_list_to_array_wrapper(func):
        def _wrapper(*args, **kwargs):
            try:
                # Convert list inputs to float64 arrays so that metrics like log_loss don't fail on finfo(int64)
                new_args = [np.asarray(arg, dtype=np.float64) if isinstance(arg, list) else arg for arg in args]
                new_kwargs = {k: (np.asarray(v, dtype=np.float64) if isinstance(v, list) else v) for k, v in kwargs.items()}
                return func(*new_args, **new_kwargs)
            except Exception as e:
                # Raise TypeError so that pyBKT's import-time check (which only catches TypeError) skips this metric safely
                raise TypeError(f"Wrapped metric check failed: {e}") from e
        return _wrapper

    for _mod in (sklearn.metrics._regression, sklearn.metrics._classification):
        for _name in dir(_mod):
            # Only wrap actual metrics, avoiding core NumPy/helper functions which could cause infinite recursion
            if re.search('_loss$|_score$|_error$', _name):
                _obj = getattr(_mod, _name)
                if callable(_obj) and not isinstance(_obj, type):
                    try:
                        setattr(_mod, _name, _make_list_to_array_wrapper(_obj))
                    except AttributeError:
                        pass
except Exception:
    pass

try:
    from pyBKT.models import Model
    import pyBKT.fit.EM_fit
    
    def patched_EM_fit_run(data, model, trans_softcounts, emission_softcounts, init_softcounts, num_outputs, parallel = True, fixed = {}):
        alldata = data["data"]
        bigT, num_subparts = len(alldata[0]), len(alldata)
        allresources, starts, learns, forgets, guesses, slips, lengths = \
                data["resources"], data["starts"], model["learns"], model["forgets"], model["guesses"], model["slips"], data["lengths"]

        prior, num_sequences, num_resources = model["prior"], len(starts), len(learns)
        normalizeLengths = False
        
        if 'prior' in fixed:
            prior = fixed['prior']
        initial_distn = np.empty((2, ), dtype = 'float')
        initial_distn[0] = 1 - prior
        initial_distn[1] = prior
        
        if 'learns' in fixed:
            learns = learns * (fixed['learns'] < 0) + fixed['learns'] * (fixed['learns'] >= 0)
        if 'forgets' in fixed:
            forgets = forgets * (fixed['forgets'] < 0) + fixed['forgets'] * (fixed['forgets'] >= 0)
        As = np.empty((2, 2 * num_resources))
        pyBKT.fit.EM_fit.interleave(As[0], 1 - learns, forgets.copy())
        pyBKT.fit.EM_fit.interleave(As[1], learns.copy(), 1 - forgets)

        if 'guesses' in fixed:
            guesses = fixed['guesses'] * (fixed['guesses'] < 0) + fixed['guesses'] * (fixed['guesses'] >= 0)
        if 'slips' in fixed:
            slips = fixed['slips'] * (fixed['slips'] < 0) + fixed['slips'] * (fixed['slips'] >= 0)
        Bn = np.empty((2, 2 * num_subparts))
        pyBKT.fit.EM_fit.interleave(Bn[0], 1 - guesses, guesses.copy())
        pyBKT.fit.EM_fit.interleave(Bn[1], slips.copy(), 1 - slips)

        all_trans_softcounts = np.zeros((2, 2 * num_resources))
        all_emission_softcounts = np.zeros((2, 2 * num_subparts))
        all_initial_softcounts = np.zeros((2, 1))

        alpha_out = np.zeros((2, bigT))

        total_loglike = np.empty((1,1))
        total_loglike.fill(0)

        input = {"As": As, "Bn": Bn, "initial_distn": initial_distn, 'allresources': allresources, \
                 'starts': starts,
                 'lengths': lengths, \
                 'num_resources': num_resources, 'num_subparts': num_subparts, \
                 'alldata': alldata, 'normalizeLengths': normalizeLengths, 'alpha_out': alpha_out}

        # Force sequential if parallel=False, otherwise use cpu_count
        num_threads = pyBKT.fit.EM_fit.cpu_count() if parallel else 1
        thread_counts = [None for _ in range(num_threads)]
        for thread_num in range(num_threads):
            blocklen = 1 + ((num_sequences - 1) // num_threads)
            sequence_idx_start = int(blocklen * thread_num)
            sequence_idx_end = min(sequence_idx_start+blocklen, num_sequences)
            thread_counts[thread_num] = {'sequence_idx_start': sequence_idx_start, 'sequence_idx_end': sequence_idx_end}
            thread_counts[thread_num].update(input)

        # Run sequentially to prevent __main__ multiprocessing issues on Windows
        x = [pyBKT.fit.EM_fit.inner(tc) for tc in thread_counts]

        for i in x:
            total_loglike += i[3]
            all_trans_softcounts += i[0]
            all_emission_softcounts += i[1]
            all_initial_softcounts += i[2]
            for sequence_start, T, alpha in i[4]:
                alpha_out[:, sequence_start: sequence_start + T] += alpha
        all_trans_softcounts = all_trans_softcounts.flatten(order = 'F')
        all_emission_softcounts = all_emission_softcounts.flatten(order = 'F')
        result = {}
        # Coerce total_loglike to standard python float to avoid numpy 2.x assignment issues
        result["total_loglike"] = float(total_loglike.squeeze())
        result["all_trans_softcounts"] = np.reshape(all_trans_softcounts, (num_resources, 2, 2), order = 'C')
        result["all_emission_softcounts"] = np.reshape(all_emission_softcounts, (num_subparts, 2, 2), order = 'C')
        result["all_initial_softcounts"] = all_initial_softcounts
        result["alpha_out"] = alpha_out.flatten(order = 'F').reshape(alpha_out.shape, order = 'C')

        return result

    pyBKT.fit.EM_fit.run = patched_EM_fit_run
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
    
    # Suppress cosmetic NumPy warnings generated inside pyBKT's EM_fit.py
    # EM_fit divides by 0 creating NaNs, but safely handles them via np.nan_to_num on line 213
    import warnings
    warnings.filterwarnings("ignore", category=RuntimeWarning, message="invalid value encountered in divide")
    
    model = Model(seed=42, num_fits=5, parallel=False)
    model.fit(data=bkt_df)

    params = model.params()
    return params


def extract_params(df: pd.DataFrame) -> dict:
    """
    Extract the four BKT parameters for each KC from pyBKT's output DataFrame.
    """
    result = {}
    
    if not isinstance(df, pd.DataFrame):
        print(f"Warning: Expected DataFrame from model.params(), got {type(df)}")
        return result

    # The index level 'skill' contains the KC names
    if 'skill' in df.index.names:
        skills = df.index.get_level_values('skill').unique()
    else:
        # Fallback if the index names are different
        skills = df.index.get_level_values(0).unique()

    for skill in skills:
        # Get all rows for this skill and reset index to make it flat
        skill_params = df.loc[skill].reset_index()
        
        def get_val(param_name):
            # The parameter name column is typically 'param'
            if 'param' in skill_params.columns:
                val = skill_params[skill_params['param'] == param_name]
            else:
                # Fallback: assume the first column contains the parameter names
                first_col = skill_params.columns[0]
                val = skill_params[skill_params[first_col] == param_name]
                
            if not val.empty:
                # The value is usually in 'value', or just the last column
                val_col = 'value' if 'value' in val.columns else val.columns[-1]
                return round(float(val[val_col].iloc[0]), 4)
            return 0.0

        result[skill] = {
            "description": KC_DESCRIPTIONS.get(skill, ""),
            "prior":  get_val("prior"),
            "learn":  get_val("learns"),
            "guess":  get_val("guesses"),
            "slip":   get_val("slips"),
            "forget": get_val("forgets"),
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
