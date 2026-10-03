import { usePostHog } from "@posthog/react";
import { useQuery } from "convex/react";
import { Megaphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
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
  feature: { label: "New", className: "text-brass" },
  fix: { label: "Fixed", className: "text-ink-muted" },
  improvement: { label: "Improved", className: "text-success" },
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
interface ChangelogButtonProps {
  /** "icon" renders the megaphone button; "none" renders only the dialog
   * (opened via `openRequest`, e.g. from the workspace account menu). */
  trigger?: "icon" | "none";
  /** Increment to open the dialog from outside. */
  openRequest?: number;
}

export default function ChangelogButton(props: ChangelogButtonProps) {
  const { data: session } = authClient.useSession();

  if (!session?.user) {
    return null;
  }

  return <AuthenticatedChangelogButton {...props} />;
}

function AuthenticatedChangelogButton({
  trigger = "icon",
  openRequest = 0,
}: ChangelogButtonProps) {
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

  const openFrom = (source: "button" | "menu") => {
    if (latestTimestamp !== undefined) {
      seenRef.current = latestTimestamp;
      writeSeenTimestamp(latestTimestamp);
    }
    posthog.capture("changelog_opened", { source });
    setOpen(true);
  };
  const handleButtonClick = () => openFrom("button");

  // Opened from outside (account menu "What's new").
  const lastRequestRef = useRef(openRequest);
  // biome-ignore lint/correctness/useExhaustiveDependencies: openFrom only uses refs and setters; run on new requests only.
  useEffect(() => {
    if (openRequest === lastRequestRef.current) return;
    lastRequestRef.current = openRequest;
    openFrom("menu");
  }, [openRequest]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {trigger === "icon" && (
        <button
          type="button"
          onClick={handleButtonClick}
          aria-label="What's new"
          className="relative grid size-7 place-items-center rounded-full border border-rule-strong text-ink-label outline-none transition-colors hover:text-brass focus-visible:outline-2 focus-visible:outline-brass cursor-pointer"
        >
          <Megaphone className="size-4" />
          {hasUnread && (
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-brass-fill ring-2 ring-surface-void" />
          )}
        </button>
      )}

      <Dialog.Content className="max-w-[600px]">
        <Dialog.Header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brass">
            Release notes
          </p>
          <Dialog.Title>What's new</Dialog.Title>
          <Dialog.Description>
            Recent updates and improvements to ExemplAI.
          </Dialog.Description>
        </Dialog.Header>

        <div className="-mx-6 max-h-[60vh] overflow-y-auto border-y border-rule-strong px-6 editorial-scroll">
          {notes === undefined ? (
            <div className="space-y-4 py-4" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded bg-rule-strong animate-pulse"
                />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <p className="py-8 text-center font-serif text-[0.95rem] text-ink-prose">
              No updates yet. Check back soon.
            </p>
          ) : (
            <ul>
              {notes.slice(0, MAX_NOTES).map((note) => {
                const meta = TYPE_META[note.type];
                return (
                  <li
                    key={note._id}
                    className="border-b border-rule py-4 last:border-b-0"
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "shrink-0 text-[9px] font-semibold uppercase tracking-[0.15em]",
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                      <h4 className="font-serif text-[15px] text-ink">
                        {note.title}
                      </h4>
                      <time className="ml-auto shrink-0 text-[10px] text-ink-label">
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
                    <div className="mt-1.5 text-xs leading-relaxed text-ink-prose [&_a]:text-brass [&_a]:underline [&_code]:font-mono [&_code]:text-brass [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-4">
                      <ReactMarkdown>{note.content}</ReactMarkdown>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Dialog.Footer>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="h-7 rounded-[2px] border border-brass-fill bg-brass-fill px-4 text-[11px] font-semibold tracking-[0.02em] text-on-brass transition-opacity hover:opacity-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            Got it
          </button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
