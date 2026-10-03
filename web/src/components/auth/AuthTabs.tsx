import { cn } from "#/lib/utils";

export interface AuthTabsProps {
  activeTab: "signin" | "signup"; // | "magiclink"
  onChange: (tab: "signin" | "signup" /* | "magiclink" */) => void;
}

const TABS = [
  { id: "signin", label: "Sign in" },
  { id: "signup", label: "Sign up" },
] as const;

/** Two-way segmented control (same pattern as the syllabus status filter). */
export function AuthTabs({ activeTab, onChange }: AuthTabsProps) {
  return (
    <div
      role="tablist"
      className="flex overflow-hidden rounded-[2px] border border-rule-strong"
    >
      {TABS.map((tab, i) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "h-8 flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass",
            i > 0 && "border-l border-rule-strong",
            activeTab === tab.id
              ? "bg-brass-fill text-on-brass"
              : "text-ink-muted hover:text-brass",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
