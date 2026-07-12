// ============================================================
// app/(auth)/layout.tsx — Layout visual para páginas de auth
// ============================================================
// Este layout envuelve SOLO las páginas dentro del Route Group (auth):
//   - /login  (app/(auth)/login/page.tsx)
//   - /register  (app/(auth)/register/page.tsx)
//
// ¿Por qué un layout separado?
//   Las páginas de auth tienen una estética diferente al dashboard:
//   formularios centrados, sin sidebar, sin navegación compleja.
//   Al crear un layout dentro del Route Group, Next.js lo aplica
//   SOLO a las páginas de este grupo, sin afectar al resto.
//
// IMPORTANTE: Este es un SERVER Component (sin 'use client').
//   Los layouts en Next.js son Server Components por defecto,
//   lo que significa que este HTML se renderiza en el servidor
//   y se envía al navegador sin JavaScript adicional.
//   Los HIJOS (login, register) sí son Client Components
//   porque necesitan interactividad (formularios, useState).
// ============================================================

import { ReactNode } from "react";
import Link from "next/link";

/**
 * Layout centrado para las páginas de autenticación.
 * Provee:
 *   - Fondo oscuro con gradiente radial sutil
 *   - Logo/nombre de la app como header
 *   - Contenedor con bordes, sombra y blur para los formularios
 *   - Diseño responsive que funciona en móvil y escritorio
 *
 * @param children - El contenido de la página (login o register)
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      {/* ════════════════════════════════════════════════════════ */}
      {/* FONDO DECORATIVO — Gradiente radial sutil                */}
      {/* ════════════════════════════════════════════════════════ */}
      {/* Este div crea un efecto de "luz" sutil detrás del formulario.
          - absolute: posición absoluta respecto al contenedor padre
          - top-0: empieza desde arriba
          - -z-10: se coloca DETRÁS de todo el contenido (z-index negativo)
          - h-full w-full: ocupa todo el viewport
          - bg-[radial-gradient(...)]: gradiente radial personalizado
            - ellipse 80% 80%: forma elíptica que cubre 80% del viewport
            - at 50% -20%: centrado horizontalmente, desplazado arriba
            - rgba(16,185,129,0.15): color emerald con 15% de opacidad
            - rgba(255,255,255,0): se desvanece a transparente
      */}
      <div className="absolute top-0 -z-10 h-full w-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]"></div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* CONTENEDOR PRINCIPAL — Ancho máximo para formularios     */}
      {/* ════════════════════════════════════════════════════════ */}
      {/* max-w-md: ancho máximo de 448px (md = medium)
          Esto asegura que el formulario no se estire demasiado
          en pantallas grandes, manteniendo una lectura cómoda.
          w-full: en pantallas pequeñas, ocupa todo el ancho disponible.
      */}
      <div className="w-full max-w-md">
        {/* ──── Logo / Nombre de la App ──── */}
        {/* mb-8: margen inferior de 32px para separar del formulario
            text-center: centra el texto horizontalmente
        */}
        <div className="mb-8 text-center">
          {/* Link al home (/): si el usuario hace click en el nombre,
              vuelve a la landing page sin recargar la página completa.
              transition-opacity: animación suave al hacer hover.
          */}
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity"
          >
            {/* El nombre de la app con "Agent" en color emerald
                para mantener consistencia con el branding de FE-01 */}
            ISTQB <span className="text-emerald-400">Agent</span>
          </Link>
        </div>

        {/* ──── Tarjeta del Formulario ──── */}
        {/* rounded-xl: bordes redondeados grandes (12px)
            border border-slate-800: borde sutil gris oscuro
            bg-slate-900/50: fondo gris oscuro con 50% de opacidad
            p-8: padding interno de 32px en todos los lados
            shadow-2xl: sombra grande para efecto de "flotar"
            backdrop-blur-sm: efecto de desenfoque en el fondo
              (funciona porque el bg tiene opacidad parcial)
        */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-sm">
          {/* {children} renderiza el contenido específico de la
              página actual: si estamos en /login, renderiza
              LoginPage; si estamos en /register, renderiza
              RegisterPage. Este es el patrón de composición
              de layouts de Next.js App Router. */}
          {children}
        </div>
      </div>
    </div>
  );
}
