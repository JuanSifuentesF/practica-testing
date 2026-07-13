"use client";

// ============================================================
// _components/main-nav.tsx — Navegación Desktop
// ============================================================
// DIRECTIVA: 'use client' es obligatoria porque:
//
//   - usePathname() es un hook de Next.js
//   - Los hooks solo pueden ejecutarse en Client Components
//   - Necesitamos acceder a la URL actual para determinar
//     qué opción del menú está activa
//
// VISIBILIDAD:
//
// Este componente solo se muestra en pantallas ≥768px
// gracias a la clase:
//
//   hidden md:flex
//
// Mobile:
//   MobileNav (menú hamburguesa)
//
// Desktop:
//   MainNav (barra horizontal)
//
// PATRÓN:
//
// Las rutas se generan dinámicamente desde un array,
// evitando duplicación de JSX y facilitando futuras
// ampliaciones del menú.
// ============================================================

import Link from "next/link";
import { usePathname } from "next/navigation";

// ─────────────────────────────────────────────────────────────
// Rutas de navegación
// ─────────────────────────────────────────────────────────────
// as const:
//   - Convierte el array en readonly
//   - Conserva los valores literales exactos
//   - Mejora la inferencia de tipos de TypeScript
//
// IMPORTANTE:
//
// Estas rutas deben mantenerse sincronizadas con:
//
//   - MobileNav
//   - Middleware de autenticación
//   - Configuración de navegación compartida
//
// En aplicaciones más grandes conviene extraerlas a:
//
//   lib/navigation.ts
//
// para reutilizarlas desde un único lugar.
// ─────────────────────────────────────────────────────────────
const routes = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/plan", label: "Mi Plan" },
  { href: "/session", label: "Sesión Actual" },
  { href: "/practice", label: "Práctica" },
  { href: "/settings/ai", label: "IA" },
] as const;

// ─────────────────────────────────────────────────────────────
// Determinar si una ruta está activa
// ─────────────────────────────────────────────────────────────
//
// Problema:
//
// pathname === href
//
// funciona para:
//
//   pathname = "/dashboard"
//
// pero falla para:
//
//   pathname = "/dashboard/settings"
//
// porque ya no son exactamente iguales.
//
// Solución:
//
// pathname.startsWith(`${href}/`)
//
// permite considerar rutas hijas como parte de la
// sección principal.
//
// Ejemplos:
//
// "/dashboard"            → Dashboard activo
// "/dashboard/settings"   → Dashboard activo
// "/practice/123"         → Práctica activa
//
// Esto mejora la experiencia de navegación porque
// el usuario siempre sabe en qué sección se encuentra.
// ─────────────────────────────────────────────────────────────
function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  // ───────────────────────────────────────────────────────────
  // Ruta actual
  // ───────────────────────────────────────────────────────────
  //
  // usePathname() devuelve la URL activa.
  //
  // Ejemplos:
  //
  //   /dashboard
  //   /plan
  //   /session/abc
  //   /practice/123/results
  //
  // La utilizamos para resaltar visualmente la opción
  // actualmente seleccionada.
  // ───────────────────────────────────────────────────────────
  const pathname = usePathname();

  return (
    // ─────────────────────────────────────────────────────────
    // Contenedor principal
    // ─────────────────────────────────────────────────────────
    //
    // hidden
    //   Oculto por defecto (mobile-first).
    //
    // md:flex
    //   Visible desde 768px.
    //
    // items-center
    //   Centra verticalmente los elementos.
    //
    // space-x-6
    //   Espaciado horizontal uniforme entre links.
    //
    // text-sm
    //   Tamaño de fuente 14px.
    //
    // font-medium
    //   Peso de fuente equilibrado para navegación.
    // ─────────────────────────────────────────────────────────
    <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
      {routes.map((route) => {
        // Determina si este enlace representa
        // la sección actualmente activa.
        const isActive = isActivePath(pathname, route.href);

        return (
          <Link
            key={route.href}
            href={route.href}
            // ───────────────────────────────────────
            // Accesibilidad
            // ───────────────────────────────────────
            //
            // aria-current="page"
            //
            // Indica a lectores de pantalla cuál es
            // la página actualmente seleccionada.
            //
            // Beneficios:
            //
            // - Mejor experiencia para usuarios
            //   con tecnologías asistivas.
            // - Cumplimiento de buenas prácticas WCAG.
            // ───────────────────────────────────────
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? // ────────────────────────────────
                  // Link activo
                  // ────────────────────────────────
                  //
                  // text-emerald-400
                  //   Color principal de la marca.
                  //
                  // hover:text-emerald-300
                  //   Ligera variación para indicar
                  //   interactividad sin perder el
                  //   estado activo.
                  // ────────────────────────────────
                  "text-emerald-400 transition-colors hover:text-emerald-300"
                : // ────────────────────────────────
                  // Link inactivo
                  // ────────────────────────────────
                  //
                  // text-slate-400
                  //   Color neutro.
                  //
                  // hover:text-emerald-400
                  //   Feedback visual al pasar el mouse.
                  // ────────────────────────────────
                  "text-slate-400 transition-colors hover:text-emerald-400"
            }
          >
            {route.label}
          </Link>
        );
      })}
    </nav>
  );
}
