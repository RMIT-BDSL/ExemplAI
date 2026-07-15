# High-level List of Stuff To Do

* Decide on course/target students: Python Programming Bootcamp (COSC3104/5), CC is Tuan-Anh, has around 80 or so students. Need to see the schedule and topic list.
  * Course schedule/outlin (Weeks): 
    1. Introduction & Environment Setup
    2. Variables and Expressions
    3. String and Formatting
    4. Branching
    5. Loops
    6. Advanced Loops
    7. No class	
    8. Functions
    9. Collections
    10. File
    11. Basic Libraries for Practical Tasks
    12. Advanced Topics
* Decide on topic list of concepts; match to the course syllabus? Don't want students to learn something more difficult than what's been covered already
  * **7 KCs from CSEDM baseline** (need to match to COSC3104/5 syllabus):
    1. `io_basics` — Console I/O, type conversion, simple returns
    2. `arithmetic` — Numeric operators and math expressions
    3. `modular_arith` — Modulo and integer division in context
    4. `conditionals` — If/elif/else branching and boolean logic
    5. `functions_params` — Function definitions, parameters, library calls
    6. `string_manip` — String slicing, concatenation, character tests
    7. `loops` — For/while iteration
* Select data set for baseline BKT. [CSEDM Data Challenges (Python)](./data/CSEDM-data.md) can be used to pre-train BKT engine. This one is in python so its a perfect fit. For future work I'm not sure. Java/Typescript/C++ would be options.
* **[NOT DONE]** Calculate the true BKT baseline values (`p_init`, `p_transit`, `p_slip`, `p_guess`) by executing the `data/fit_bkt_baseline.py` script.
* **[NOT DONE]** Initialize the BKT scores in Convex:
  * Add `bkt_parameters` and `user_bkt_state` tables to `schema.ts`.
  * Create an initialization mutation (e.g. `initializeUserBKT`) to give new students starting scores.
  * Seed the database with the true baseline values calculated from the Python script.
