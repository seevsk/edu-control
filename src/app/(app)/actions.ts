"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/server/auth/session";
import { COOKIE_BIENVENIDA } from "./_components/bienvenida-cookie";

export async function ocultarBienvenidaAction() {
  await requerirSesion();
  const store = await cookies();
  store.set(COOKIE_BIENVENIDA, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/");
}
