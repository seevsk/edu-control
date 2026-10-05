"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Toast de confirmacion. Lee el mensaje de un query param y limpia la URL al mostrarlo. */
export function Toast({ mensaje }: { mensaje: string | undefined }) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(mensaje));

  useEffect(() => {
    if (!mensaje) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });

    const ocultar = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(ocultar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensaje]);

  if (!mensaje || !visible) return null;

  return (
    <div
      role="status"
      className="animate-page-in fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-md border border-estado-completada/30 bg-surface px-4 py-3 text-sm shadow-lg sm:inset-x-auto sm:right-4"
    >
      <span className="size-2 shrink-0 rounded-full bg-estado-completada" aria-hidden />
      {mensaje}
    </div>
  );
}
