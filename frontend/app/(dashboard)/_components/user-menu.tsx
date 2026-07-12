"use client";

// ============================================================
// _components/user-menu.tsx — Menú de Usuario (Avatar + Dropdown)
// ============================================================
// DIRECTIVA: 'use client' porque:
//   - onClick handlers → para el botón de logout
//   - useRouter → para navegación programática tras logout
//   - createClient (browser) → para llamar supabase.auth.signOut()
//
// PROPS: Recibe email y name desde el Dashboard Layout (Server Component).
// Este es el patrón "Server-to-Client composition":
//   - El Server Component obtiene datos seguros (sesión, perfil)
//   - Los pasa como props a este Client Component
//   - El Client Component se encarga de la interactividad
//
// SEGURIDAD: El logout usa el cliente del NAVEGADOR (client.ts),
// no el del servidor. Esto es correcto porque signOut() necesita
// invalidar las cookies del navegador, que solo son accesibles
// desde document.cookie (el entorno del browser).
// ============================================================

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ─── Props del componente ───
// Usamos una interface separada para documentar claramente qué espera este componente.
// El Dashboard Layout (Server Component) es responsable de pasar estos valores.
interface UserMenuProps {
  /** Email del usuario autenticado (ej: "juan@email.com") */
  email: string;
  /** Nombre completo del usuario (ej: "Juan Pérez") o fallback al email local */
  name: string;
}

export function UserMenu({ email, name }: UserMenuProps) {
  // ─── Router para navegación programática ───
  // useRouter() solo funciona en Client Components.
  // Lo usamos para redirigir al login después del logout.
  const router = useRouter();

  // ─── Cliente Supabase del navegador ───
  // Usamos createClient() de lib/supabase/client.ts (no server.ts)
  // porque necesitamos invalidar las cookies del NAVEGADOR.
  const supabase = createClient();

  // ─── Handler de Logout ───
  const handleLogout = async () => {
    // 1. Llamar a Supabase para invalidar la sesión.
    //    signOut() elimina las cookies de sesión del navegador
    //    y revoca el refresh token en el servidor de Supabase.
    await supabase.auth.signOut();

    // 2. Redirigir al login.
    //    router.push() hace una navegación del lado del cliente.
    router.push("/login");

    // 3. Forzar un refresh del Router Cache de Next.js.
    //    router.refresh() invalida el cache del servidor para que
    //    el middleware re-evalúe la sesión. Sin esto, el usuario
    //    podría usar el botón "Atrás" del navegador y ver la página
    //    cacheada del dashboard (aunque ya no tenga sesión).
    router.refresh();
  };

  // ─── Calcular iniciales para el avatar ───
  // "Juan Pérez" → "JP", "Ana" → "A", "maria.garcia@email.com" → "MA"
  // Tomamos las primeras letras de cada palabra, las unimos,
  // las convertimos a mayúsculas y limitamos a 2 caracteres.
  const initials = name
    .split(" ") // "Juan Pérez" → ["Juan", "Pérez"]
    .map((n) => n[0]) // → ["J", "P"]
    .join("") // → "JP"
    .toUpperCase() // → "JP" (ya estaba, pero por seguridad)
    .substring(0, 2); // Máximo 2 caracteres (ej: si hay 3+ palabras)

  return (
    // ─── DropdownMenu de shadcn/ui ───
    // Este componente usa Radix UI DropdownMenu internamente.
    // Se compone de: Trigger (el elemento que abre el menú),
    // Content (el menú en sí) y Items (las opciones).
    <DropdownMenu>
      {/* ─── Trigger: Avatar del usuario ───
          Al hacer click en este avatar, se abre el menú.
          focus:outline-none evita el anillo de focus azul por defecto
          del browser, ya que Radix maneja su propio estilo de focus. */}
      <DropdownMenuTrigger className="focus:outline-none">
        <Avatar
          className="
            h-9 w-9              
            border border-slate-700
            bg-slate-800         
            transition-opacity   
            hover:opacity-80     
            cursor-pointer       
          "
        >
          {/* AvatarFallback muestra las iniciales.
              En el futuro, podrías agregar AvatarImage para
              mostrar una foto de perfil si el usuario sube una. */}
          <AvatarFallback className="bg-slate-800 text-slate-300 text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      {/* ─── Contenido del Dropdown ───
          align="end" → el menú se alinea al borde derecho del trigger
          w-56 → ancho fijo de 224px (suficiente para emails largos)
          Las clases de fondo y borde mantienen la coherencia visual. */}
      <DropdownMenuContent
        align="end"
        className="w-56 bg-slate-900 border-slate-800 text-slate-300"
      >
        {/* ─── Sección de información del usuario ─── */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {/* Nombre en blanco (más prominente) */}
            <p className="text-sm font-medium leading-none text-white">
              {name}
            </p>
            {/* Email en gris (secundario) */}
            <p className="text-xs leading-none text-slate-500">{email}</p>
          </div>
        </DropdownMenuLabel>

        {/* ─── Separador visual ─── */}
        <DropdownMenuSeparator className="bg-slate-800" />

        {/* ─── Opción de Cerrar Sesión ───
            El color rojo (red-400) indica una acción destructiva.
            focus:bg-red-950/50 → fondo rojo sutil al hacer hover/focus.
            cursor-pointer → indica que es clickeable. */}
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-400 focus:bg-red-950/50 focus:text-red-300 cursor-pointer"
        >
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
