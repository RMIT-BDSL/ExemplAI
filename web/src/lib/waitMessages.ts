// What the chat shows while the tutor writes an example (Get help / New example).
// A new line about every 3 s, or sooner when the server reports a step, so a
// slow reply (~20 s) walks through them all and a fast one shows only the first
// few. The last line stays until the reply arrives.

export const EXAMPLE_WAIT_LINES = [
  "Reading your submission",
  "Evaluating any errors",
  "Building an example",
  "Checking my work",
  "Pretty printing",
] as const;

export const WAIT_LINE_SECONDS = 3;

const AGENT_NODES = [
  "complete_example_node",
  "faded_example_node",
  "erroneous_example_node",
  "control_agent_node",
];

/** Index of the line to show as current, from the seconds waited and the
 *  graph steps finished so far. */
export function exampleWaitLine(seconds: number, steps: string[]): number {
  let fromSteps = 0;
  if (steps.includes("input_guardrail")) fromSteps = 1;
  const lastDraft = Math.max(...AGENT_NODES.map((n) => steps.lastIndexOf(n)));
  // A draft written since the Dean's last check is being checked now.
  if (lastDraft >= 0 && lastDraft > steps.lastIndexOf("dean_validation_node"))
    fromSteps = 3;
  const fromTime = Math.floor(seconds / WAIT_LINE_SECONDS);
  return Math.min(Math.max(fromSteps, fromTime), EXAMPLE_WAIT_LINES.length - 1);
}
