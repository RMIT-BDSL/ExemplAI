# CSEDM Data Challenges (Python) Dataset

The **CSEDM Data Challenges (Python)** dataset follows the **ProgSnap2** format, which is a standardized, CSV-based structure designed specifically for logging programming process data. 

A typical dataset is organized into a main directory containing top-level metadata and event files, along with subdirectories for the actual code snapshots.

## Directory Structure

```text
/Dataset_Root
├── MainTable.csv           # The core event log (every student action)
├── DatasetMetadata.csv     # Metadata about the dataset
├── /CodeStates             # Folder containing the actual Python code files
│   ├── CS_001.py
│   ├── CS_002.py
│   └── ...
├── /LinkTables             # Mappings for things like CourseID to Course details
└── /Resources              # Additional data blobs like compiler error logs
```

## 1. The Core Event Log (`MainTable.csv`)

This is the most important file in the dataset. It logs every single interaction a student has with the programming environment sequentially.

A simplified conceptual example of this CSV looks like:

| EventID | Order | EventType | SubjectID | ProblemID | CodeStateID | CompileResult | Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1001 | 1 | `Run.Program` | `Student_A` | `Lab1_Hello` | `CS_001` | `Error` | 0 |
| 1002 | 2 | `Compile.Error`| `Student_A` | `Lab1_Hello` | `CS_001` | `SyntaxError` | |
| 1003 | 3 | `File.Edit` | `Student_A` | `Lab1_Hello` | `CS_002` | | |
| 1004 | 4 | `Run.Program` | `Student_A` | `Lab1_Hello` | `CS_002` | `Success` | 100 |

## 2. The Code Snapshots (`/CodeStates/`)

The `CodeStateID` from the `MainTable.csv` refers to specific files saved at that exact moment in time.

For example, `CS_001.py` might look like:

```python
# Student's first attempt (Contains a Syntax Error)
print("Hello World"
```

And `CS_002.py` (after the `File.Edit` event) might look like:

```python
# Student's fixed attempt
print("Hello World")
```

## Why it's ideal for BKT (Bayesian Knowledge Tracing)

Because the dataset tracks every granular step—down to every syntax error, edit, and successful run—it provides the exact sequence of "successes" and "failures" needed to calculate the baseline probabilities (`Prior`, `Transit`, `Slip`, `Guess`) of a student mastering a specific Python concept over time. This historical data is crucial for pre-training a BKT engine without introducing practice effects on active study participants.

*Credit: This dataset uses data and formats developed for the CSEDM 2019 Data Challenge, organized by Thomas P. See the official repository at [https://github.com/thomaswp/CSEDM2019-Data-Challenge](https://github.com/thomaswp/CSEDM2019-Data-Challenge).*
