"use client";

// ============================================================
// app/(auth)/login/page.tsx — Página de inicio de sesión
// ============================================================
// 'use client' es OBLIGATORIO aquí porque:
//   - useState: maneja el estado de los campos del formulario
//   - useRouter: para navegación programática después del login
//   - onChange/onSubmit: event handlers del formulario
//
// Flujo del login:
//   1. Usuario escribe email y password en los campos
//   2. Al hacer submit, se llama a signInWithPassword()
//   3. Supabase Auth valida las credenciales
//   4. Si es exitoso: redirige al dashboard + refresca el router
//   5. Si falla: muestra un mensaje de error en rojo
//
// URL final: /login (el (auth) del Route Group no afecta la URL)
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// Importamos el cliente de Supabase para el NAVEGADOR.
// NO el de servidor — este componente se ejecuta en el browser.
import { createClient } from "@/lib/supabase/client";
// Componentes de shadcn/ui — viven en nuestro proyecto (components/ui/)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  // ─── Estado del formulario ───
  // Cada campo del formulario tiene su propio state.
  // Esto se llama "controlled components" en React:
  // React es la "fuente de verdad" del valor de cada campo.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ─── Estado de UI ───
  // `error` guarda el mensaje de error si el login falla.
  // `loading` desactiva el botón mientras se procesa la petición.
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ─── Router de Next.js ───
  // useRouter() devuelve el router del App Router (no el de Pages Router).
  // Lo usamos para navegación programática (push) y para invalidar
  // el caché de Server Components (refresh).
  const router = useRouter();

  /**
   * Maneja el envío del formulario de login.
   *
   * @param e - El evento del formulario (FormEvent)
   */
  const handleLogin = async (e: React.FormEvent) => {
    // preventDefault() evita que el navegador recargue la página
    // al hacer submit del formulario. En una SPA/SSR app, queremos
    // manejar el submit con JavaScript, no con una recarga.
    e.preventDefault();

    // Activar estado de carga y limpiar errores previos
    setLoading(true);
    setError(null);

    // Crear el cliente de Supabase para el navegador.
    // @supabase/ssr implementa un singleton interno, así que
    // llamar a createClient() múltiples veces es eficiente.
    const supabase = createClient();

    // ─── Intentar autenticar al usuario ───
    // signInWithPassword() envía las credenciales al servidor
    // de Supabase Auth. Si el email y password son correctos,
    // Supabase devuelve tokens JWT que se guardan como cookies.
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // ❌ Las credenciales son incorrectas o hubo un error.
      // Mostramos el mensaje de error de Supabase al usuario.
      // Ejemplos de error.message:
      //   - "Invalid login credentials"
      //   - "Email not confirmed"
      //   - "Email rate limit exceeded"
      setError(error.message);
      setLoading(false);
    } else {
      // ✅ Login exitoso — los tokens JWT ya están en las cookies.

      // push('/dashboard'): navega al dashboard.
      // PERO: sin refresh(), Next.js podría servir una versión
      // cacheada del dashboard que fue renderizada SIN sesión,
      // causando que el middleware vuelva a redirigir a /login.
      router.push("/dashboard");

      // refresh(): fuerza a Next.js a:
      // 1. Invalidar el caché del Router Client-Side
      // 2. Re-ejecutar los Server Components con cookies frescas
      // 3. El middleware ve la sesión nueva y permite el acceso
      //
      // Sin esta línea, podrías quedar en un loop de redirecciones.
      router.refresh();
    }
  };

  return (
    <>
      {/* ──── Título y subtítulo ──── */}
      <h1 className="mb-2 text-2xl font-semibold text-white">Iniciar Sesión</h1>
      <p className="mb-6 text-sm text-slate-400">
        Ingresa tus credenciales para continuar con tu plan de estudio.
      </p>

      {/* ──── Formulario ──── */}
      {/* space-y-4: agrega 16px de espacio vertical entre cada hijo */}
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Campo: Email */}
        <div className="space-y-2">
          {/* Label de shadcn/ui — asociado al input por htmlFor */}
          <Label htmlFor="email" className="text-slate-300">
            Correo Electrónico
          </Label>
          {/* Input de shadcn/ui — personalizado con clases de Tailwind.
              - bg-slate-950: fondo muy oscuro (más que el contenedor)
              - border-slate-700: borde gris medio
              - text-white: texto blanco para contraste
              - placeholder:text-slate-500: placeholder gris medio
              Estas clases SOBRESCRIBEN los estilos default de shadcn
              porque Tailwind tiene la misma especificidad y el orden
              de las clases importa.
          */}
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Campo: Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-slate-950 border-slate-700 text-white"
          />
        </div>

        {/* ──── Mensaje de error ──── */}
        {/* Renderizado condicional: solo se muestra si `error` no es null.
            - bg-red-900/30: fondo rojo con 30% de opacidad
            - border border-red-800: borde rojo sutil
            - text-red-400: texto rojo claro para legibilidad
        */}
        {error && (
          <div className="rounded-md bg-red-900/30 p-3 border border-red-800 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ──── Botón de submit ──── */}
        {/* disabled={loading}: desactiva el botón mientras se procesa.
            Esto previene doble-click y envíos múltiples.
            El texto cambia a "Verificando..." para dar feedback visual.
            
            Usamos bg-emerald-600 para mantener consistencia con el
            branding de la app (emerald = color primario del ISTQB Agent).
        */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {loading ? "Verificando..." : "Entrar"}
        </Button>
      </form>

      {/* ──── Link al registro ──── */}
      {/* mt-6: margen superior de 24px para separar del formulario
          Link de Next.js: navegación client-side sin recarga completa.
          text-emerald-400: color consistente con el branding.
      */}
      <div className="mt-6 text-center text-sm text-slate-400">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-emerald-400 hover:underline">
          Regístrate aquí
        </Link>
      </div>
    </>
  );
}
