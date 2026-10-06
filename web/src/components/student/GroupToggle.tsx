import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "#/lib/utils.ts";

const GROUPS = [
  { value: "experimental", label: "Experimental" },
  { value: "control", label: "Control" },
] as const;

/**
 * Staff testing only: switches the signed-in user's study group. Rendered only
 * while the Convex environment variable CONDITION_TOGGLE is "on"
 * (convex/experiment.ts), which also gates the mutation, so production
 * students never see or use it.
 */
export default function GroupToggle() {
  const mine = useQuery(api.experiment.getMyCondition);
  const setCondition = useMutation(api.experiment.setMyCondition);
  if (!mine?.toggleEnabled) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Study group (testing)"
      title="Testing only: switch your study group. The chat restarts in the new group."
      className="mr-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-ink-label"
    >
      <span>Group</span>
      <div className="flex rounded-[2px] border border-rule-strong">
        {GROUPS.map((g) => {
          const active = mine.condition === g.value;
          return (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (!active) setCondition({ condition: g.value }).catch(() => {});
              }}
              className={cn(
                "px-2 py-0.5 uppercase tracking-[0.15em] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
                active ? "bg-brass-fill text-on-brass" : "hover:text-brass",
              )}
            >
              {g.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
