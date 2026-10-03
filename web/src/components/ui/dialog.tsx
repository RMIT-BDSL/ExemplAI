import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

/**
 * Reusable modal built on top of `radix-ui`, styled with the workspace
 * tokens (styles.css --xa-*), so it follows the light/dark theme. Mirrors the `button.tsx` /
 * `sonner.tsx` convention of a thin styled wrapper over the primitive.
 *
 * Usage:
 *   <Dialog.Root open={open} onOpenChange={setOpen}>
 *     <Dialog.Trigger asChild>...</Dialog.Trigger>
 *     <Dialog.Portal>
 *       <Dialog.Content>
 *         <Dialog.Title>...</Dialog.Title>
 *         <Dialog.Description>...</Dialog.Description>
 *         ...
 *       </Dialog.Content>
 *     </Dialog.Portal>
 *   </Dialog.Root>
 */
function DialogRoot({ ...props }: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof Dialog.Portal>) {
  return <Dialog.Portal {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof Dialog.Overlay>) {
  return (
    <Dialog.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Dialog.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <Dialog.Portal>
      <DialogOverlay />
      <Dialog.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[4px] border border-rule-strong bg-surface-raised p-6 text-ink shadow-lg",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <Dialog.Close
            className="absolute right-4 top-4 grid size-6 place-items-center rounded-[2px] text-ink-label outline-none transition-colors hover:text-brass focus-visible:outline-2 focus-visible:outline-brass cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        )}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      data-slot="dialog-title"
      className={cn(
        "font-serif text-xl font-medium tracking-[-0.01em] text-ink",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Dialog.Description>) {
  return (
    <Dialog.Description
      data-slot="dialog-description"
      className={cn("text-xs text-ink-label", className)}
      {...props}
    />
  );
}

export {
  DialogContent as Content,
  DialogDescription as Description,
  DialogFooter as Footer,
  DialogHeader as Header,
  DialogOverlay as Overlay,
  DialogPortal as Portal,
  DialogRoot as Root,
  DialogTitle as Title,
  DialogTrigger as Trigger,
};
