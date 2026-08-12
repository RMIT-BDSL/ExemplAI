import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

/**
 * Reusable modal built on top of `radix-ui`. Mirrors the `button.tsx` /
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
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
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
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 gap-4 border border-line bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-6 shadow-xl rounded-2xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <Dialog.Close
            className="absolute right-4 top-4 rounded-md p-1 text-sea-ink-soft outline-none transition-colors hover:bg-sand dark:hover:bg-white/10 hover:text-sea-ink focus-visible:ring-1 focus-visible:ring-lagoon/40 cursor-pointer"
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
        "text-base font-bold tracking-tight text-sea-ink",
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
      className={cn("text-xs text-sea-ink-soft", className)}
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
