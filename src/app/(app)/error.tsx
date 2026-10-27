"use client";

import { useEffect } from "react";

export default function ErrorApp({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-3 rounded-md border border-danger/30 bg-surface p-6">
      <h1 className="text-lg font-semibold">No pudimos cargar esta página</h1>
      <p className="text-sm text-text-muted">
        Puede ser un problema temporal. Intenta nuevamente; tus datos no se modificaron.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
