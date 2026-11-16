import { redirect } from "next/navigation";

/** El módulo Invitaciones se integró a la Bandeja (pedido del usuario, 2026-11-16); los enlaces antiguos siguen funcionando. */
export default function InvitacionesPage() {
  redirect("/notificaciones?filtro=invitaciones");
}
