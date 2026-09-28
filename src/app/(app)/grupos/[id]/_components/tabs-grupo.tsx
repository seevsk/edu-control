import Link from "next/link";

export function TabsGrupo({ idGrupo, activa }: { idGrupo: number; activa: "resumen" | "tareas" }) {
  const tabs = [
    { key: "resumen", label: "Resumen", href: `/grupos/${idGrupo}` },
    { key: "tareas", label: "Tareas", href: `/grupos/${idGrupo}/tareas` },
  ] as const;

  return (
    <div className="flex gap-4 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
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
