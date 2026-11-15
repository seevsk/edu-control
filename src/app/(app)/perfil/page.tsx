import Link from "next/link";
import { BookOpen, Briefcase, Clock, Lock, Pencil } from "lucide-react";
import { requerirSesion } from "@/server/auth/session";
import { obtenerPerfilCompleto } from "@/server/services/perfil";
import { listarMisGrupos } from "@/server/services/grupo";
import { mesAnio } from "@/lib/formato-fecha";
import { aOracion } from "@/lib/presentacion";
import { formatoTitulo } from "@/lib/nombres";
import { PaginaCompleta } from "@/components/ui-app/page-header";
import { Migas } from "@/components/ui-app/barra-superior";
import { PanelLateral } from "@/components/ui-app/panel-lateral";
import { UserAvatar } from "@/components/ui-app/user-avatar";
import { CourseDot } from "@/components/ui-app/course-dot";
import { CampoSelect } from "@/components/ui-app/campo-select";
import { CampoToggle } from "@/components/ui-app/campo-toggle";
import { Toast } from "@/components/toast";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { actualizarPerfilAction } from "./actions";
import { BiografiaConContador, EliminarCuenta, SwitchVisibilidad } from "./_components/interactivos";

const ROLES = { lider: "Líder", miembro: "Miembro", observador: "Observador" } as const;
const CAMPO = "flex flex-col gap-1.5 text-[13px] font-medium";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border-subtle py-2.5 text-sm">
      <dt className="w-40 shrink-0 text-subtle-foreground">{etiqueta}</dt>
      <dd className="min-w-[200px] flex-1">{children}</dd>
    </div>
  );
}

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ error?: string; toast?: string; editar?: string }> }) {
  const sesion = await requerirSesion();
  const { error, toast, editar } = await searchParams;
  const [usuario, grupos] = await Promise.all([obtenerPerfilCompleto(sesion.idUsuario), listarMisGrupos(sesion.idUsuario)]);
  const perfil = usuario.perfil!;
  const nombreCompleto = formatoTitulo(`${usuario.nombre} ${usuario.apellidos ?? ""}`);
  const tipo = perfil.tipoCuenta === "profesor" ? "Profesor" : "Estudiante";
  const resumen = [tipo, perfil.carrera, perfil.ciclo ? `${perfil.ciclo}.º ciclo` : null].filter(Boolean).join(" · ");
  const activos = grupos.filter((grupo) => grupo.estado === "activo");
  const abrirEdicion = editar === "1";

  return (
    <PaginaCompleta>
      <Migas items={[{ texto: "Perfil" }]} />
      <Toast mensaje={toast} />
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-8 px-4 py-8 sm:px-8">
        <section className="flex flex-wrap items-start gap-5">
          <UserAvatar usuario={usuario} className="size-[72px] text-3xl" />
          <div className="min-w-[260px] flex-1">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">{nombreCompleto}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{resumen}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
              {perfil.institucion ? <span className="inline-flex items-center gap-1.5"><BookOpen className="size-3.5" aria-hidden />{perfil.institucion}</span> : null}
              {perfil.trabaja ? <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" aria-hidden />Trabaja y estudia</span> : null}
              <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />Miembro desde {mesAnio(usuario.fechaRegistro)}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/perfil?editar=1" scroll={false}><Pencil aria-hidden />Editar perfil</Link>
          </Button>
        </section>

        {perfil.biografia ? (
          <p className="max-w-2xl text-sm whitespace-pre-wrap text-muted-foreground">{perfil.biografia}</p>
        ) : (
          <section className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-input p-4">
            <p className="flex-1 text-sm text-muted-foreground">Agrega una biografía corta para que tus compañeros sepan en qué eres bueno y cómo prefieres coordinar.</p>
            <Link href="/perfil?editar=1" scroll={false} className="text-[13px] underline underline-offset-2">Agregar biografía</Link>
          </section>
        )}

        <div className="flex flex-wrap items-start gap-10">
          <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-8">
            <section>
              <h2 className="mb-2 text-sm font-semibold">Información</h2>
              <dl>
                <Dato etiqueta="Correo">
                  {usuario.correo}
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-subtle-foreground"><Lock className="size-3" aria-hidden />Solo tú lo ves</span>
                </Dato>
                <Dato etiqueta="Tipo de cuenta">{tipo}</Dato>
                <Dato etiqueta="Institución">{perfil.institucion ?? <span className="text-subtle-foreground">Sin registrar</span>}</Dato>
                <Dato etiqueta="Carrera">{perfil.carrera ?? <span className="text-subtle-foreground">Sin registrar</span>}</Dato>
                <Dato etiqueta="Ciclo">{perfil.ciclo ? `${perfil.ciclo}.º ciclo` : <span className="text-subtle-foreground">Sin registrar</span>}</Dato>
                <Dato etiqueta="Trabaja">{perfil.trabaja ? "Sí, además de estudiar" : "No"}</Dato>
              </dl>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold">Privacidad</h2>
              <div className="flex items-center gap-4 border-b border-border-subtle py-3.5">
                <label htmlFor="visible-en-busqueda" className="flex-1 cursor-pointer">
                  <span className="block text-sm">Aparecer en la búsqueda de personas</span>
                  <span id="visible-en-busqueda-ayuda" className="mt-0.5 block text-[13px] text-subtle-foreground">
                    Si lo apagas, solo tus compañeros de grupo pueden ver tu perfil. Se guarda al instante.
                  </span>
                </label>
                <SwitchVisibilidad inicial={perfil.visibleEnBusqueda} />
              </div>
            </section>

            <section className="flex flex-wrap items-center gap-4 rounded-lg border border-destructive/30 p-4">
              <div className="min-w-[260px] flex-1">
                <p className="text-sm font-medium">Eliminar cuenta</p>
                <p className="mt-0.5 text-[13px] text-subtle-foreground">Se borran tu nombre, correo y foto. Tus tareas se conservan para no romper los grupos. No se puede deshacer.</p>
              </div>
              <EliminarCuenta />
            </section>
          </div>

          <aside className="min-w-0 flex-[1_1_260px]">
            <h2 className="mb-2 text-sm font-semibold">Tus grupos</h2>
            {activos.length ? (
              <ul>
                {activos.map((grupo) => {
                  const rol = grupo.integrantes.find((integrante) => integrante.idUsuario === sesion.idUsuario)?.rol;
                  const curso = grupo.evaluacion?.curso ?? null;
                  return (
                    <li key={grupo.idGrupo}>
                      <Link href={`/grupos/${grupo.idGrupo}`} className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-[13px] hover:bg-muted">
                        {curso ? <CourseDot idCurso={curso.idCurso} /> : <span className="size-2" aria-hidden />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{aOracion(grupo.nombre)}</span>
                          {curso ? <span className="block truncate text-xs text-subtle-foreground">{aOracion(curso.nombre)}</span> : null}
                        </span>
                        {rol ? <span className="text-xs text-muted-foreground">{ROLES[rol]}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-subtle-foreground">Los grupos en los que participes aparecerán aquí.</p>
            )}
          </aside>
        </div>
      </div>

      {abrirEdicion ? (
        <PanelLateral titulo="Editar perfil" cerrarEn="/perfil">
          {error ? <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p> : null}
          <form action={actualizarPerfilAction} className="flex flex-col gap-4">
            {/* La privacidad se edita con su switch en la vista; aqui se conserva su valor. */}
            {perfil.visibleEnBusqueda ? <input type="hidden" name="visibleEnBusqueda" value="on" /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={CAMPO}>Nombres<Input name="nombre" required maxLength={120} defaultValue={usuario.nombre} /></label>
              <label className={CAMPO}>Apellidos<Input name="apellidos" maxLength={120} defaultValue={usuario.apellidos ?? ""} /></label>
            </div>
            <div className={CAMPO}>
              Tipo de cuenta
              <CampoToggle name="tipoCuenta" etiqueta="Tipo de cuenta" defaultValue={perfil.tipoCuenta} opciones={[{ valor: "estudiante", texto: "Estudiante" }, { valor: "profesor", texto: "Profesor" }]} />
            </div>
            <label className={CAMPO}>Institución<Input name="institucion" maxLength={160} defaultValue={perfil.institucion ?? ""} placeholder="Institución San Ignacio de Loyola" /></label>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <label className={CAMPO}>Carrera<Input name="carrera" maxLength={160} defaultValue={perfil.carrera ?? ""} /></label>
              <label className={CAMPO}>
                Ciclo
                <CampoSelect
                  name="ciclo"
                  defaultValue={perfil.ciclo ? String(perfil.ciclo) : ""}
                  opciones={[{ valor: "", texto: "Sin indicar" }, ...Array.from({ length: 10 }, (_, indice) => ({ valor: String(indice + 1), texto: `${indice + 1}.º ciclo` }))]}
                />
              </label>
            </div>
            <label className={CAMPO} htmlFor="biografia">
              Biografía
              <BiografiaConContador inicial={perfil.biografia ?? ""} />
            </label>
            <label className="flex items-center justify-between gap-3 text-[13px] font-medium">
              Trabajo además de estudiar
              <Switch name="trabaja" defaultChecked={perfil.trabaja} />
            </label>
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button variant="ghost" asChild><Link href="/perfil" scroll={false}>Cancelar</Link></Button>
              <SubmitButton className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Guardar cambios</SubmitButton>
            </div>
          </form>
        </PanelLateral>
      ) : null}
    </PaginaCompleta>
  );
}
