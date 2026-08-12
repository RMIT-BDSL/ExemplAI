import { usePostHog } from "@posthog/react";
import { useQuery } from "convex/react";
import { Megaphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "#/components/ui/button";
import * as Dialog from "#/components/ui/dialog";
import { authClient } from "#/lib/auth-client";
import { cn } from "#/lib/utils.ts";
import { api } from "../../../convex/_generated/api";

const STORAGE_KEY = "exemplai.changelog.seen";

/** Number of release notes to show in the modal. */
const MAX_NOTES = 20;

type ReleaseNote = {
  _id: string;
  type: "feature" | "fix" | "improvement";
  timestamp: number;
  title: string;
  content: string;
};

const TYPE_META: Record<
  ReleaseNote["type"],
  { label: string; className: string }
> = {
  feature: {
    label: "New",
    className: "bg-lagoon/10 text-lagoon border-lagoon/20",
  },
  fix: {
    label: "Fixed",
    className:
      "bg-amber/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  improvement: {
    label: "Improved",
    className: "bg-palm/10 text-palm border-palm/20",
  },
};

function readSeenTimestamp(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeSeenTimestamp(ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(ts));
}

/**
 * In-app changelog launcher.
 *
 * - Fetches release notes (newest first) for authenticated, eligible users.
 * - "Display once": on first load, if the newest note is newer than the last
 *   seen timestamp persisted in localStorage, the modal auto-opens. The seen
 *   timestamp is updated on close, so it only re-opens when a newer note
 *   arrives.
 * - Dedicated button always opens the modal and marks everything seen.
 */
export default function ChangelogButton() {
  const { data: session } = authClient.useSession();

  if (!session?.user) {
    return null;
  }

  return <AuthenticatedChangelogButton />;
}

function AuthenticatedChangelogButton() {
  const notes = useQuery(api.releaseNotes.listPublic);
  const posthog = usePostHog();
  const [open, setOpen] = useState(false);

  // Tracking refs so auto-open runs exactly once per mount.
  const seenRef = useRef<number>(readSeenTimestamp());
  const autoOpenedRef = useRef(false);

  const latestTimestamp = notes?.[0]?.timestamp;
  const hasUnread =
    latestTimestamp !== undefined && latestTimestamp > seenRef.current;

  // Auto-open once when a newer release note arrives.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (latestTimestamp === undefined) return;
    autoOpenedRef.current = true;

    if (latestTimestamp > seenRef.current) {
      posthog.capture("changelog_opened", { source: "auto" });
      setOpen(true);
    }
  }, [latestTimestamp, posthog]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && latestTimestamp !== undefined) {
      // Persist the seen timestamp so it doesn't auto-open again until a
      // newer note is published.
      seenRef.current = latestTimestamp;
      writeSeenTimestamp(latestTimestamp);
    }
  };

  const handleButtonClick = () => {
    if (latestTimestamp !== undefined) {
      seenRef.current = latestTimestamp;
      writeSeenTimestamp(latestTimestamp);
    }
    posthog.capture("changelog_opened", { source: "button" });
    setOpen(true);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={handleButtonClick}
        aria-label="What's new"
        className="relative flex size-9 items-center justify-center rounded-full border border-line bg-white/70 dark:bg-white/5 text-sea-ink-soft outline-none transition-all hover:bg-sand/50 dark:hover:bg-white/10 hover:text-sea-ink focus-visible:ring-1 focus-visible:ring-lagoon/40 cursor-pointer"
      >
        <Megaphone className="size-4" />
        {hasUnread && (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-palm ring-2 ring-white dark:ring-zinc-900" />
        )}
      </button>

      <Dialog.Content className="max-w-[600px]">
        <Dialog.Header>
          <Dialog.Title className="flex items-center gap-2">
            <Megaphone className="size-4 text-lagoon" />
            What's new
          </Dialog.Title>
          <Dialog.Description>
            Recent updates and improvements to ExemplAI.
          </Dialog.Description>
        </Dialog.Header>

        <div className="-mx-2 max-h-[60vh] overflow-y-auto px-2 pr-3">
          {notes === undefined ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl border border-line bg-zinc-100/60 dark:bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <p className="py-6 text-center text-xs text-sea-ink-soft">
              No updates yet. Check back soon!
            </p>
          ) : (
            <ul className="space-y-4 py-1">
              {notes.slice(0, MAX_NOTES).map((note) => {
                const meta = TYPE_META[note.type];
                return (
                  <li
                    key={note._id}
                    className="rounded-xl border border-line bg-white/60 dark:bg-white/[0.02] p-3.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center border text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                      <h4 className="text-[13px] font-semibold text-sea-ink">
                        {note.title}
                      </h4>
                      <time className="ml-auto text-[10px] text-sea-ink-soft">
                        {new Date(note.timestamp).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </time>
                    </div>
                    <div className="prose prose-sm prose-zinc dark:prose-invert mt-2 max-w-none text-xs text-sea-ink-soft [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-lagoon">
                      <ReactMarkdown>{note.content}</ReactMarkdown>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Dialog.Footer>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Got it
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
