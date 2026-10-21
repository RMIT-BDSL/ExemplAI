import { useEffect, useState } from "react";

/** "Collapse all" / "Expand all" from the footer: `n` counts presses, so each one applies once. */
export interface FoldAll {
  open: boolean;
  n: number;
}

/** A block's own open state, which follows each Collapse/Expand all. */
export function useFold(defaultOpen: boolean, all: FoldAll) {
  const [open, setOpen] = useState(defaultOpen);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new press applies, not a re-render
  useEffect(() => {
    if (all.n > 0) setOpen(all.open);
  }, [all.n]);
  return [open, setOpen] as const;
}
