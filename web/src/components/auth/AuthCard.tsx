import type * as React from "react";

export interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

/** Sign-in / sign-up panel in the workspace style (tokens, serif title, hairline borders). */
export function AuthCard({ children, title, subtitle }: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <p className="mb-4 text-center text-[13px] font-semibold tracking-tight text-ink">
        ExemplAI
      </p>
      <div className="rounded-[4px] border border-rule-strong bg-surface-panel p-8">
        <header className="mb-6">
          <h1 className="font-serif text-[1.6rem] font-medium leading-tight tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="mt-2 font-serif text-[0.95rem] leading-relaxed text-ink-prose">
            {subtitle}
          </p>
        </header>
        <div className="flex flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}
