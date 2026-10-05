import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconInicio(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 8.5V17h10V8.5" />
    </svg>
  );
}

export function IconCursos(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 5.5c2-1 5.5-1 6.5.5 1-1.5 4.5-1.5 6.5-.5v9c-2-1-5.5-1-6.5.5-1-1.5-4.5-1.5-6.5-.5Z" />
      <path d="M10 6v9" />
    </svg>
  );
}

export function IconCalendario(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
      <path d="M3.5 8.5h13M7 3v3M13 3v3" />
    </svg>
  );
}

export function IconGrupos(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="7.2" cy="7.5" r="2.2" />
      <circle cx="13.6" cy="7.5" r="2.2" />
      <path d="M2.8 16c.4-2.3 2.1-3.7 4.4-3.7s4 1.4 4.4 3.7M10.8 12.5c1.9.2 3.4 1.6 3.8 3.5" />
    </svg>
  );
}

export function IconInvitaciones(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="14" height="10" rx="1.5" />
      <path d="M3.3 5.7 10 10.5l6.7-4.8" />
    </svg>
  );
}

export function IconPerfil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 16.5c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5" />
    </svg>
  );
}

export function IconCampana(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5.5 14.5V9a4.5 4.5 0 0 1 9 0v5.5l1.2 1.5H4.3Z" />
      <path d="M8.3 17.3a1.8 1.8 0 0 0 3.4 0" />
    </svg>
  );
}

export function IconBuscar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="8.7" cy="8.7" r="5" />
      <path d="M16.3 16.3 12.6 12.6" />
    </svg>
  );
}

export function IconBuscarPersonas(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="7.5" cy="6.5" r="2.7" />
      <path d="M2.5 16c.5-3 2.4-4.6 5-4.6 1 0 1.9.2 2.6.6" />
      <circle cx="14" cy="13" r="2.6" />
      <path d="m16 15 1.8 1.8" />
    </svg>
  );
}

export function IconReloj(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="6.75" />
      <path d="M10 6.5V10l2.6 1.6" />
    </svg>
  );
}

export function IconChevronIzquierda(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.5 6.5 10l5.5 5.5" />
    </svg>
  );
}

export function IconChevronDerecha(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M8 4.5 13.5 10 8 15.5" />
    </svg>
  );
}

export function IconAgregar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  );
}

export function IconMas(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <circle cx="10" cy="4.5" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="10" cy="15.5" r="1.4" />
    </svg>
  );
}

export function IconGoogle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      <path
        fill="#4285F4"
        d="M19.6 10.23c0-.68-.06-1.32-.17-1.94H10v3.67h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.25Z"
      />
      <path
        fill="#34A853"
        d="M10 20c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H1.07v2.58A10 10 0 0 0 10 20Z"
      />
      <path
        fill="#FBBC05"
        d="M4.41 11.93A6 6 0 0 1 4.09 10c0-.67.11-1.32.32-1.93V5.49H1.07A10 10 0 0 0 0 10c0 1.61.39 3.14 1.07 4.51l3.34-2.58Z"
      />
      <path
        fill="#EA4335"
        d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.95.98 12.7 0 10 0 6.09 0 2.71 2.24 1.07 5.49l3.34 2.58C5.2 5.71 7.4 3.96 10 3.96Z"
      />
    </svg>
  );
}
