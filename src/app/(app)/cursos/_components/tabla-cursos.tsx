"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CourseDot } from "@/components/ui-app/course-dot";

export interface FilaCurso {
  idCurso: number;
  nombre: string;
  codigo: string | null;
  importado: boolean;
  docente: string | null;
  modalidad: string;
  horario: string;
  evaluacion: { texto: string; destacada: boolean };
  grupos: string;
  menu: ReactNode;
}

const TH = "h-9 border-b bg-sidebar px-4 text-left text-xs font-medium whitespace-nowrap text-subtle-foreground";
const TD = "h-[52px] border-b border-border-subtle px-4 text-[13px] whitespace-nowrap";

/** Tabla de cursos con filtro en vivo (sin boton "Buscar"); con poco ancho, scroll horizontal dentro de su caja. */
export function TablaCursos({ filas, vacio }: { filas: FilaCurso[]; vacio: ReactNode }) {
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const texto = consulta.trim().toLocaleLowerCase("es-PE");
  const visibles = texto
    ? filas.filter((fila) => [fila.nombre, fila.codigo, fila.docente].some((valor) => valor?.toLocaleLowerCase("es-PE").includes(texto)))
    : filas;

  return (
    <>
      <div className="flex justify-end px-4 pt-3 sm:px-8">
        <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-input px-3 text-subtle-foreground focus-within:border-ring md:h-[30px] md:max-w-64 md:rounded-md md:px-2.5">
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Filtrar cursos</span>
          <input
            type="search"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Filtrar por curso o docente"
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle-foreground"
          />
        </label>
      </div>
      {/* Móvil: lista (Claude Design, "Móvil · Tú / Cursos"); desde md, la tabla completa. */}
      <ul className="mt-3 border-t border-border-subtle md:hidden">
        {visibles.map((fila) => (
          <li key={fila.idCurso} className="flex items-center border-b border-border-subtle">
            <Link href={`/cursos/${fila.idCurso}`} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4">
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-secondary">
                <CourseDot idCurso={fila.idCurso} className="size-2.5 rounded-[3px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{fila.nombre}</span>
                <span className="block truncate text-[13px] text-subtle-foreground">{[fila.horario, fila.modalidad].filter((valor) => valor && valor !== "—").join(" · ")}</span>
                {fila.evaluacion.destacada ? <span className="block truncate text-[13px] text-muted-foreground">{fila.evaluacion.texto}</span> : null}
              </span>
            </Link>
            <span className="pr-2">{fila.menu}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 overflow-x-auto max-md:hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${TH} pl-4 sm:pl-8`}>Curso</th>
              <th className={TH}>Docente</th>
              <th className={TH}>Modalidad</th>
              <th className={TH}>Horario</th>
              <th className={TH}>Próxima evaluación</th>
              <th className={TH}>Grupos</th>
              <th className={`${TH} w-0 pr-4 sm:pr-8`}><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila) => (
              <tr
                key={fila.idCurso}
                className="cursor-pointer hover:bg-muted"
                onClick={(evento) => {
                  if ((evento.target as HTMLElement).closest("a, button, form, [role=menu]")) return;
                  router.push(`/cursos/${fila.idCurso}`);
                }}
              >
                <td className={`${TD} pl-4 sm:pl-8`}>
                  <span className="flex items-center gap-2.5">
                    <CourseDot idCurso={fila.idCurso} className="size-2.5 rounded-[3px]" />
                    <Link href={`/cursos/${fila.idCurso}`} className="font-medium hover:underline">{fila.nombre}</Link>
                    {fila.codigo ? <span className="font-mono text-xs text-subtle-foreground">{fila.codigo}</span> : null}
                    {fila.importado ? <span className="rounded-full border px-1.5 py-px text-[11px] text-muted-foreground">Importado</span> : null}
                  </span>
                </td>
                <td className={`${TD} text-muted-foreground`}>{fila.docente ?? "—"}</td>
                <td className={`${TD} text-muted-foreground`}>{fila.modalidad}</td>
                <td className={`${TD} text-muted-foreground`}>{fila.horario}</td>
                <td className={`${TD} ${fila.evaluacion.destacada ? "" : "text-subtle-foreground"}`}>{fila.evaluacion.texto}</td>
                <td className={`${TD} text-muted-foreground`}>{fila.grupos}</td>
                <td className={`${TD} pr-4 sm:pr-8`}>{fila.menu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibles.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-subtle-foreground sm:px-8">
          {texto ? "Ningún curso coincide con el filtro." : vacio}
        </div>
      ) : null}
    </>
  );
}
