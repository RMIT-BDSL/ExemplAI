export default function ResetCodeForm({
  setShowResetModal,
  handleReset,
}: {
  setShowResetModal: (showResetModal: boolean) => void;
  handleReset: () => void;
}) {
  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/75">
      <div className="w-full max-w-md rounded-lg border border-zinc-850 bg-slate-900 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <h3 className="text-lg font-semibold text-zinc-100">Reset Template Code</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Are you sure you want to reset the editor to the default template? Your current code for
          this language will be lost.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setShowResetModal(false)}
            className="rounded-md border border-zinc-850 bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              handleReset();
              setShowResetModal(false);
            }}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
