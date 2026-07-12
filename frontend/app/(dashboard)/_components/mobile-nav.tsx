"use client";

// ============================================================
// _components/mobile-nav.tsx — Navegación Mobile (Hamburguesa)
// ============================================================
// DIRECTIVA: 'use client' porque:
//   - useState → controla si el Sheet está abierto o cerrado
//   - usePathname → detecta la ruta activa para estilizar links
//   - useEffect → cierra el Sheet automáticamente al navegar
//   - onClick handlers → en el botón hamburguesa y los links
//
// VISIBILIDAD: Solo se muestra en pantallas <768px (md:hidden).
// En desktop está completamente oculto y MainNav toma el control.
//
// COMPONENTE SHEET: shadcn/ui Sheet es un drawer/panel que se
// desliza desde un borde de la pantalla. Internamente usa
// Radix UI Dialog con animaciones CSS de transform.
// Configuramos side="left" para que se deslice desde la izquierda,
// que es la convención más común en apps mobile.
// ============================================================

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

// ─── Rutas (mismas que MainNav para consistencia) ───
// IMPORTANTE: Si agregas rutas nuevas aquí, agrégalas también en main-nav.tsx.
// En un proyecto más grande, podrías extraer este array a un archivo compartido
// como lib/navigation.ts y importarlo en ambos componentes.
const routes = [
  { href: "/dashboard", label: "Dashboard", emoji: "📊" },
  { href: "/plan", label: "Mi Plan", emoji: "📋" },
  { href: "/session", label: "Sesión Actual", emoji: "📖" },
];

export function MobileNav() {
  // ─── Estado del Sheet ───
  // open: controla si el panel lateral está visible
  // setOpen: función para cambiarlo
  const [open, setOpen] = useState(false);

  // ─── Ruta actual ───
  const pathname = usePathname();

  // ─── Cerrar Sheet automáticamente al navegar ───
  // useEffect con [pathname] se ejecuta cada vez que la URL cambia.
  // Esto asegura que cuando el usuario toca un link dentro del Sheet,
  // el panel se cierra automáticamente después de la navegación.
  // Sin esto, el Sheet permanecería abierto mostrando la página anterior.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    // ─── Contenedor ───
    // md:hidden → OCULTO en pantallas ≥768px (solo visible en mobile)
    // Este div envuelve todo el componente del Sheet para que
    // desaparezca completamente en desktop.
    <div className="md:hidden">
      {/* ─── Sheet de shadcn/ui ───
          open y onOpenChange proporcionan "controlled state":
          el Sheet se abre/cierra basado en nuestro state,
          no en su estado interno. Esto nos permite cerrarlo
          programáticamente (por ejemplo, al navegar). */}
      <Sheet open={open} onOpenChange={setOpen}>
        {/* ─── Trigger: Botón Hamburguesa ───
            SheetTrigger renderiza el elemento que abre el Sheet.
            asChild le dice a Radix que use el Button hijo como
            trigger en lugar de crear un elemento wrapper adicional. */}
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Abrir menú de navegación"
          >
            {/* ─── Icono de hamburguesa ───
                Menu es un icono de lucide-react (3 líneas horizontales).
                h-5 w-5 = 20x20px, tamaño estándar para iconos de acción. */}
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        {/* ─── Contenido del Panel Lateral ───
            side="left" → el panel se desliza desde la izquierda
            Las clases de estilo mantienen la coherencia visual con
            el esquema de colores oscuro del resto de la app.
            w-[280px] → ancho fijo de 280px, cómodo para texto y emojis. */}
        <SheetContent
          side="left"
          className="w-[280px] bg-slate-950 border-slate-800 text-slate-50 p-6"
        >
          {/* ─── Título del Sheet (accesibilidad) ───
              SheetTitle es requerido por Radix UI para accesibilidad.
              Los screen readers necesitan un título para identificar
              el panel. Si no lo incluyes, Radix lanza un warning. */}
          <SheetTitle className="text-lg font-bold text-white mb-2">
            ISTQB <span className="text-emerald-400">Agent</span>
          </SheetTitle>

          {/* ─── Separador visual ─── */}
          <div className="border-b border-slate-800 mb-4" />

          {/* ─── Links de navegación ─── */}
          <nav className="flex flex-col space-y-1">
            {routes.map((route) => (
              <SheetClose asChild key={route.href}>
                {/* SheetClose envuelve cada Link para que el Sheet
                    se cierre automáticamente al hacer click.
                    asChild evita renderizar un elemento DOM extra. */}
                <Link
                  href={route.href}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-3
                    text-sm font-medium transition-colors
                    ${
                      pathname.startsWith(route.href)
                        ? // Link activo: fondo verde sutil + texto verde
                          "bg-emerald-950/50 text-emerald-400"
                        : // Link inactivo: sin fondo + texto gris
                          "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                    }
                  `}
                >
                  {/* Emoji como identificador visual del link.
                      Los emojis son más intuitivos que iconos SVG
                      para usuarios que navegan rápido. */}
                  <span className="text-lg">{route.emoji}</span>
                  {route.label}
                </Link>
              </SheetClose>
            ))}
          </nav>

          {/* ─── Footer del Sheet ─── */}
          <div className="mt-auto pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-600 text-center">
              ISTQB Study Agent v1.0
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
