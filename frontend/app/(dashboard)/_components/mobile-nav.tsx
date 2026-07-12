"use client";

// ============================================================
// _components/mobile-nav.tsx — Navegación Mobile (Hamburguesa)
// ============================================================
// DIRECTIVA: 'use client' porque:
//   - useState → controla si el Sheet está abierto o cerrado
//   - usePathname → detecta la ruta activa para estilizar links
//   - useEffect → cierra el Sheet automáticamente al navegar
//   - onClick handlers → manejados internamente por Sheet/Link
//
// VISIBILIDAD: Solo se muestra en pantallas <768px (md:hidden).
// En desktop está completamente oculto y MainNav toma el control.
//
// COMPONENTE SHEET:
// Sheet de shadcn/ui es un drawer lateral construido sobre
// Radix UI Dialog. Configuramos side="left" para seguir la
// convención estándar de navegación mobile.
//
// MEJORA IMPORTANTE:
// Se utiliza una función auxiliar isActivePath() para detectar
// correctamente rutas hijas.
//
// Ejemplo:
//   href = "/practice"
//   pathname = "/practice/123"
//
// Resultado:
//   true → el menú permanece resaltado.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// ─────────────────────────────────────────────────────────────
// Rutas de navegación
// ─────────────────────────────────────────────────────────────
// as const:
// Convierte el array en readonly y preserva los valores
// literales exactos para obtener mejor inferencia de tipos.
//
// IMPORTANTE:
// Si agregas nuevas rutas aquí, agrégalas también en MainNav.
// En aplicaciones grandes conviene extraerlas a:
//   lib/navigation.ts
// para reutilizarlas entre desktop y mobile.
// ─────────────────────────────────────────────────────────────
const routes = [
  { href: "/dashboard", label: "Dashboard", emoji: "📊" },
  { href: "/plan", label: "Mi Plan", emoji: "📋" },
  { href: "/session", label: "Sesión Actual", emoji: "📖" },
  { href: "/practice", label: "Práctica", emoji: "🔬" },
] as const;

// ─────────────────────────────────────────────────────────────
// Detectar ruta activa
// ─────────────────────────────────────────────────────────────
// Esta función resuelve un problema común:
//
// pathname = "/practice/123"
// href     = "/practice"
//
// Si utilizáramos pathname === href,
// el menú NO aparecería activo.
//
// startsWith(`${href}/`) permite considerar rutas hijas
// como parte de la sección principal.
// ─────────────────────────────────────────────────────────────
function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  // ───────────────────────────────────────────────────────────
  // Estado del Sheet
  // ───────────────────────────────────────────────────────────
  // open:
  //   true  → panel visible
  //   false → panel oculto
  //
  // setOpen:
  //   función para abrir/cerrar el drawer.
  // ───────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);

  // ───────────────────────────────────────────────────────────
  // Ruta actual
  // ───────────────────────────────────────────────────────────
  // usePathname obtiene la URL activa desde App Router.
  //
  // Ejemplos:
  //   /dashboard
  //   /practice
  //   /practice/123
  // ───────────────────────────────────────────────────────────
  const pathname = usePathname();

  // ───────────────────────────────────────────────────────────
  // Cerrar automáticamente al navegar
  // ───────────────────────────────────────────────────────────
  // Cada vez que cambia pathname:
  //
  // 1. Usuario toca un link
  // 2. Next.js navega
  // 3. pathname cambia
  // 4. setOpen(false)
  //
  // Resultado:
  // El drawer desaparece automáticamente después de navegar.
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    // ─────────────────────────────────────────────────────────
    // Contenedor principal
    // ─────────────────────────────────────────────────────────
    // md:hidden:
    // Oculto desde 768px hacia arriba.
    //
    // Desktop:
    //   MainNav
    //
    // Mobile:
    //   MobileNav
    // ─────────────────────────────────────────────────────────
    <div className="md:hidden">
      {/* ────────────────────────────────────────────────
          Sheet controlado
          ────────────────────────────────────────────────
          open + onOpenChange permiten controlar el estado
          desde React en lugar de depender del estado
          interno de Radix.
      */}
      <Sheet open={open} onOpenChange={setOpen}>
        {/* ──────────────────────────────────────────────
            Trigger (botón hamburguesa)
            ──────────────────────────────────────────────
            asChild evita que Radix genere wrappers
            adicionales en el DOM.
        */}
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Abrir menú de navegación"
          >
            {/* Icono hamburguesa (20x20px) */}
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        {/* ──────────────────────────────────────────────
            Panel lateral
            ──────────────────────────────────────────────
            side="left"
              → aparece desde la izquierda

            flex flex-col
              → permite que mt-auto empuje el footer
                 hacia la parte inferior.

            w-[280px]
              → ancho fijo cómodo para mobile.
        */}
        <SheetContent
          side="left"
          className="flex w-[280px] flex-col border-slate-800 bg-slate-950 p-6 text-slate-50"
        >
          {/* ────────────────────────────────────────────
              Título accesible
              ────────────────────────────────────────────
              Radix recomienda incluir un título para
              screen readers y navegación asistida.
          */}
          <SheetTitle className="mb-2 text-lg font-bold text-white">
            ISTQB <span className="text-emerald-400">Agent</span>
          </SheetTitle>

          {/* Separador visual */}
          <div className="mb-4 border-b border-slate-800" />

          {/* ────────────────────────────────────────────
              Navegación principal
              ────────────────────────────────────────────
          */}
          <nav className="flex flex-col space-y-1">
            {routes.map((route) => {
              // Determina si este link representa
              // la página actualmente visualizada.
              const isActive = isActivePath(pathname, route.href);

              return (
                <SheetClose asChild key={route.href}>
                  {/* ────────────────────────────────
                      Link de navegación
                      ────────────────────────────────
                      aria-current="page":
                      mejora accesibilidad indicando
                      al lector de pantalla cuál es
                      la página activa.
                  */}
                  <Link
                    href={route.href}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? // Estado activo
                          "flex items-center gap-3 rounded-lg bg-emerald-950/50 px-3 py-3 text-sm font-medium text-emerald-400 transition-colors"
                        : // Estado inactivo
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white"
                    }
                  >
                    {/* Emoji decorativo
                        aria-hidden evita que el lector
                        de pantalla lo anuncie. */}
                    <span className="text-lg" aria-hidden="true">
                      {route.emoji}
                    </span>

                    {route.label}
                  </Link>
                </SheetClose>
              );
            })}
          </nav>

          {/* ────────────────────────────────────────────
              Footer
              ────────────────────────────────────────────
              mt-auto aprovecha flex-col para empujar
              este bloque al final del panel.
          */}
          <div className="mt-auto border-t border-slate-800 pt-4">
            <p className="text-center text-xs text-slate-600">
              ISTQB Study Agent v1.0
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
