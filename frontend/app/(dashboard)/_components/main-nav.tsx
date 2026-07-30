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
import { useAiSession } from "@/components/ai/ai-session-provider";

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
  const pathname = usePathname();
  const { byokApiKey } = useAiSession();

  return (
    <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
      {routes.map((route) => {
        const isActive = isActivePath(pathname, route.href);
        const isAiRoute = route.href === "/settings/ai";

        return (
          <Link
            key={route.href}
            href={route.href}
            data-tour={
              route.href === "/settings/ai"
                ? "ai-config"
                : route.href === "/practice"
                ? "practice-tab"
                : undefined
            }
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "text-emerald-400 transition-colors hover:text-emerald-300 light:text-emerald-700 light:hover:text-emerald-800"
                : "text-muted-foreground transition-colors hover:text-emerald-400 light:hover:text-emerald-700"
            }
          >
            {isAiRoute ? (
              <span className="inline-flex items-center gap-1.5">
                {byokApiKey !== "" ? (
                  <span className="size-2 rounded-full bg-emerald-400 light:bg-emerald-600" title="API Key de IA lista" />
                ) : (
                  <span className="size-2 rounded-full bg-amber-400 animate-pulse light:bg-amber-500" title="API Key de IA requerida" />
                )}
                {route.label}
                {byokApiKey === "" && <span className="text-xs">🔑</span>}
              </span>
            ) : (
              route.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
