import Link from "next/link";

export function TabsGrupo({
  idGrupo,
  activa,
}: {
  idGrupo: number;
  activa: "resumen" | "tareas" | "horarios" | "reuniones" | "actividad";
}) {
  const tabs = [
    { key: "resumen", label: "Resumen", href: `/grupos/${idGrupo}` },
    { key: "tareas", label: "Tareas", href: `/grupos/${idGrupo}/tareas` },
    { key: "horarios", label: "Horarios", href: `/grupos/${idGrupo}/horarios` },
    { key: "reuniones", label: "Reuniones", href: `/grupos/${idGrupo}/reuniones` },
    { key: "actividad", label: "Actividad", href: `/grupos/${idGrupo}/actividad` },
  ] as const;

  return (
    <div className="flex gap-4 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-medium ${
            activa === tab.key
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
