import { NextResponse } from "next/server";
import { cerrarSesion } from "@/server/auth/session";
import { env } from "@/lib/env";

export async function POST() {
  await cerrarSesion();
  return NextResponse.redirect(new URL("/login", env.APP_URL));
}
