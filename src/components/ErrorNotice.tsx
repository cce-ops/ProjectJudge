export function ErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-bold">Error durante el procesamiento</p>
      <p className="mt-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 rounded-lg border border-red-300 px-3 py-1 text-xs font-bold hover:bg-red-100"
      >
        Cerrar
      </button>
    </div>
  );
}
