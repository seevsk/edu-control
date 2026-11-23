import type { ContenidoCorreo, CorreoRenderizado } from "./contenido";

/**
 * Layout único de los correos de EduControl. HTML para clientes de correo: tablas de
 * presentación, estilos inline, sin JS, sin CSS externo y sin SVG. El modo oscuro es una mejora
 * progresiva (`prefers-color-scheme`): los clientes que la ignoran muestran la versión clara.
 * Función pura: no lee variables de entorno, recibe `appUrl`.
 */

/** Ruta pública del monograma en PNG (src/app/correo-logo.png/route.tsx). */
export const RUTA_LOGO_CORREO = "/correo-logo.png";

const FUENTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Paleta "Tinta" (src/app/globals.css).
const C = {
  fondo: "#f7f7f8",
  tarjeta: "#ffffff",
  borde: "#e9e9eb",
  tinta: "#18181b",
  texto: "#27272a",
  suave: "#52525b",
  caja: "#fafafa",
  blanco: "#ffffff",
};

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * URL absoluta a partir de una ruta relativa generada por el servidor. Si la ruta apunta a otro
 * origen (nunca debería), se usa la raíz de la app para no enlazar fuera.
 */
export function urlAbsoluta(ruta: string, appUrl: string): string {
  const base = new URL(appUrl);
  const url = new URL(ruta, base);
  return url.origin === base.origin ? url.toString() : base.toString();
}

export interface OpcionesCorreo {
  asunto: string;
  contenido: ContenidoCorreo;
  /** Ruta relativa del destino (la de la notificación). */
  enlace: string;
  appUrl: string;
  /** Ruta relativa para silenciar los correos de actividad (Integrantes del grupo). */
  enlaceSilenciar?: string;
}

export function renderizarCorreo(opciones: OpcionesCorreo): CorreoRenderizado {
  return {
    asunto: opciones.asunto,
    html: renderizarHtml(opciones),
    texto: renderizarTexto(opciones),
  };
}

function renderizarHtml({ asunto, contenido, enlace, appUrl, enlaceSilenciar }: OpcionesCorreo): string {
  const url = escaparHtml(urlAbsoluta(enlace, appUrl));
  const inicio = escaparHtml(urlAbsoluta("/", appUrl));
  const logo = escaparHtml(urlAbsoluta(RUTA_LOGO_CORREO, appUrl));
  const silenciar = enlaceSilenciar ? escaparHtml(urlAbsoluta(enlaceSilenciar, appUrl)) : null;
  const e = escaparHtml;

  // Relleno tras el preheader: evita que la bandeja complete la vista previa con el cuerpo.
  const relleno = "&#847;&zwnj;&nbsp;".repeat(90);

  const parrafos = contenido.parrafos
    .map(
      (parrafo, i) =>
        `<p class="ec-texto" style="margin:${i === 0 ? "0" : "12px"} 0 0;font-family:${FUENTE};font-size:15px;line-height:24px;color:${C.texto};">${e(parrafo)}</p>`,
    )
    .join("");

  const cita = contenido.cita
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 0;">
<tr><td class="ec-caja ec-cita" style="padding:12px 16px;background-color:${C.caja};border-left:3px solid ${C.tinta};border-radius:0 6px 6px 0;">
<p class="ec-suave" style="margin:0 0 4px;font-family:${FUENTE};font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.02em;color:${C.suave};">${e(contenido.cita.etiqueta)}</p>
<p class="ec-texto" style="margin:0;font-family:${FUENTE};font-size:14px;line-height:22px;color:${C.texto};white-space:pre-line;">${e(contenido.cita.texto)}</p>
</td></tr></table>`
    : "";

  const detalles = contenido.detalles?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="ec-borde" style="margin:24px 0 0;border:1px solid ${C.borde};border-radius:8px;border-collapse:separate;">
${contenido.detalles
  .map(
    (detalle, i) => `<tr>
<td class="ec-suave${i > 0 ? " ec-borde" : ""}" valign="top" width="128" style="padding:10px 0 10px 16px;${i > 0 ? `border-top:1px solid ${C.borde};` : ""}font-family:${FUENTE};font-size:13px;line-height:20px;color:${C.suave};width:128px;">${e(detalle.etiqueta)}</td>
<td class="ec-texto${i > 0 ? " ec-borde" : ""}" valign="top" style="padding:10px 16px 10px 8px;${i > 0 ? `border-top:1px solid ${C.borde};` : ""}font-family:${FUENTE};font-size:14px;line-height:20px;font-weight:500;color:${C.tinta};">${e(detalle.valor)}</td>
</tr>`,
  )
  .join("\n")}
</table>`
    : "";

  // Botón "a prueba de balas": la celda pinta el fondo (Outlook usa mso-padding-alt) y el enlace
  // con padding hace clicable todo el botón en el resto de clientes.
  const boton = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
<tr><td class="ec-boton" align="center" bgcolor="${C.tinta}" style="border-radius:8px;background-color:${C.tinta};mso-padding-alt:12px 22px;">
<a class="ec-boton-a" href="${url}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FUENTE};font-size:14px;line-height:20px;font-weight:600;color:${C.blanco};text-decoration:none;border-radius:8px;mso-padding-alt:0;">${e(contenido.cta)}</a>
</td></tr></table>`;

  const respaldo = `<p class="ec-suave" style="margin:20px 0 0;font-family:${FUENTE};font-size:12px;line-height:18px;color:${C.suave};">Si el botón no funciona, copia este enlace en tu navegador:<br><a class="ec-enlace" href="${url}" target="_blank" style="color:${C.tinta};text-decoration:underline;word-break:break-all;">${url}</a></p>`;

  const pieSilenciar =
    silenciar && contenido.grupo
      ? `<p class="ec-suave" style="margin:8px 0 0;font-family:${FUENTE};font-size:12px;line-height:18px;color:${C.suave};">¿Demasiados correos de ${e(contenido.grupo)}? Desactiva los correos de actividad en <a class="ec-enlace" href="${silenciar}" target="_blank" style="color:${C.suave};text-decoration:underline;">Integrantes del grupo</a>. Las invitaciones, tareas asignadas o devueltas y reuniones te seguirán llegando.</p>`
      : "";

  return `<!doctype html>
<html lang="es" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(asunto)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
@media only screen and (max-width: 600px) {
  .ec-exterior { padding: 20px 12px !important; }
  .ec-pad { padding: 24px 20px !important; }
}
@media (prefers-color-scheme: dark) {
  .ec-fondo { background-color: #0a0a0a !important; }
  .ec-tarjeta { background-color: #111111 !important; border-color: #1f1f1f !important; }
  .ec-texto { color: #ededed !important; }
  .ec-suave { color: #a1a1a1 !important; }
  .ec-borde { border-color: #1f1f1f !important; }
  .ec-caja { background-color: #0a0a0a !important; }
  .ec-cita { border-left-color: #ededed !important; }
  .ec-boton { background-color: #ededed !important; }
  .ec-boton-a { color: #0a0a0a !important; }
  .ec-enlace { color: #ededed !important; }
}
</style>
</head>
<body class="ec-fondo" style="margin:0;padding:0;background-color:${C.fondo};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;color:${C.fondo};">${e(contenido.preheader)}${relleno}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="ec-fondo" style="background-color:${C.fondo};">
<tr><td align="center" class="ec-exterior" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="560" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
<tr><td style="padding:0 4px 20px;">
<a href="${inicio}" target="_blank" style="text-decoration:none;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="middle" style="padding:0 10px 0 0;"><img src="${logo}" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border:0;border-radius:7px;"></td>
<td valign="middle" class="ec-texto" style="font-family:${FUENTE};font-size:16px;line-height:20px;font-weight:600;letter-spacing:-0.02em;color:${C.tinta};">EduControl</td>
</tr></table>
</a>
</td></tr>
<tr><td class="ec-tarjeta ec-pad" style="padding:36px 36px 32px;background-color:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;">
<h1 class="ec-texto" style="margin:0 0 16px;font-family:${FUENTE};font-size:22px;line-height:30px;font-weight:600;letter-spacing:-0.01em;color:${C.tinta};">${e(contenido.titular)}</h1>
${parrafos}
${cita}
${detalles}
${boton}
${respaldo}
</td></tr>
<tr><td style="padding:24px 4px 0;">
<p class="ec-suave" style="margin:0;font-family:${FUENTE};font-size:12px;line-height:18px;color:${C.suave};">${e(contenido.motivo)}</p>
${pieSilenciar}
<p class="ec-suave" style="margin:16px 0 0;font-family:${FUENTE};font-size:12px;line-height:18px;color:${C.suave};">EduControl · Correo automático, no respondas a este mensaje.</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

function renderizarTexto({ contenido, enlace, appUrl, enlaceSilenciar }: OpcionesCorreo): string {
  const bloques: string[] = [contenido.titular, contenido.parrafos.join("\n\n")];
  if (contenido.cita) bloques.push(`${contenido.cita.etiqueta}:\n> ${contenido.cita.texto.replaceAll("\n", "\n> ")}`);
  if (contenido.detalles?.length) {
    bloques.push(contenido.detalles.map((detalle) => `${detalle.etiqueta}: ${detalle.valor}`).join("\n"));
  }
  bloques.push(`${contenido.cta}: ${urlAbsoluta(enlace, appUrl)}`);

  const pie = ["--", contenido.motivo];
  if (enlaceSilenciar && contenido.grupo) {
    pie.push(
      `Para dejar de recibir correos de actividad de ${contenido.grupo}, desactívalos en Integrantes del grupo: ${urlAbsoluta(enlaceSilenciar, appUrl)}`,
    );
  }
  pie.push("EduControl · Correo automático, no respondas a este mensaje.");
  bloques.push(pie.join("\n"));
  return bloques.join("\n\n");
}
