"use client";

// ============================================================
// _components/main-nav.tsx — Navegación Desktop
// ============================================================
// DIRECTIVA: 'use client' es OBLIGATORIO aquí porque:
//   - usePathname() es un hook de React → solo funciona en Client Components
//   - Los hooks acceden a APIs del navegador (la URL actual del browser)
//
// VISIBILIDAD: Este componente solo se muestra en pantallas ≥768px
// gracias a la clase "hidden md:flex". En móvil se oculta y se
// reemplaza por MobileNav (el componente con el menú hamburguesa).
//
// PATRÓN: Usa un array de rutas para generar los links dinámicamente.
// Esto facilita agregar nuevas rutas en el futuro sin tocar el JSX.
// ============================================================

import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── Definición de rutas de la aplicación ───
// Cada objeto tiene un href (la ruta URL) y un label (texto visible).
// Estas rutas deben coincidir con las que el middleware protege en FE-03.
const routes = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/plan", label: "Mi Plan" },
  { href: "/session", label: "Sesión Actual" },
];

export function MainNav() {
  // usePathname() retorna la ruta actual del navegador, por ejemplo "/dashboard".
  // Lo usamos para determinar cuál link está "activo" y estilizarlo diferente.
  const pathname = usePathname();

  return (
    // ─── Contenedor de navegación ───
    // hidden     → oculto por defecto (mobile first)
    // md:flex    → visible como flex en pantallas ≥768px (breakpoint "md" de Tailwind)
    // items-center → centra verticalmente los links dentro del nav
    // space-x-6   → 1.5rem (24px) de espacio horizontal entre cada link
    // text-sm     → tamaño de fuente 0.875rem (14px) — sutil pero legible
    // font-medium → peso de fuente 500 — ni thin ni bold, equilibrado
    <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={`
            transition-colors       
            hover:text-emerald-400  
            ${
              // ─── Lógica de "link activo" ───
              // pathname.startsWith() en lugar de pathname === porque:
              // - /dashboard/settings también debería resaltar "Dashboard"
              // - /session/abc123/theory también debería resaltar "Sesión Actual"
              // El link activo se muestra en verde esmeralda (emerald-400),
              // los inactivos en gris (slate-400).
              pathname.startsWith(route.href)
                ? "text-emerald-400" // ← Link activo: verde esmeralda
                : "text-slate-400" // ← Link inactivo: gris tenue
            }
          `}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  );
}
