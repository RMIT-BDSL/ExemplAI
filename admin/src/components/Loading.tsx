import type { Component } from 'solid-js';

const Loading: Component = () => {
  return (
    <div class="min-h-screen bg-paper flex flex-col items-center justify-center gap-5">
      <span class="grid place-items-center w-11 h-11 rounded-md bg-ink text-paper font-display text-2xl animate-pulse">
        E
      </span>
      <span class="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Checking your session…
      </span>
    </div>
  );
};

export default Loading;
