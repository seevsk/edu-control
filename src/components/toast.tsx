"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Confirmacion que llega por ?toast=: la muestra con sonner y limpia la URL. */
export function Toast({ mensaje }: { mensaje: string | undefined }) {
  const router = useRouter();

  useEffect(() => {
    if (!mensaje) return;
    toast.success(mensaje);
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensaje]);

  return null;
}
