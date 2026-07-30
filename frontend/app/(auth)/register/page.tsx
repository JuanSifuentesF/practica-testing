"use client";

// ============================================================
// app/(auth)/register/page.tsx — Página de registro de usuario
// ============================================================
// 'use client' es OBLIGATORIO por las mismas razones que login:
//   useState, useRouter, onChange, onSubmit.
//
// Diferencias clave con login:
//   1. Campo adicional: fullName (nombre completo)
//   2. Usa signUp() en vez de signInWithPassword()
//   3. Envía options.data.full_name que el trigger DB-05 lee
//
// Flujo del registro:
//   1. Usuario escribe nombre, email y password
//   2. signUp() envía los datos a Supabase Auth
//   3. Supabase crea el usuario en auth.users
//   4. El trigger on_auth_user_created se ejecuta automáticamente
//   5. El trigger inserta en user_profiles con el full_name
//   6. Si enable_confirmations=false (dev), el usuario queda
//      autenticado inmediatamente y se redirige al dashboard
//
// URL final: /register
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  // ─── Estado del formulario ───
  // Tres campos controlados para el registro
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ─── Estado de UI ───
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  /**
   * Maneja el envío del formulario de registro.
   *
   * IMPORTANTE: El campo `full_name` se envía dentro de
   * `options.data`. Supabase lo almacena en la columna
   * `raw_user_meta_data` de auth.users como un JSONB.
   *
   * El trigger de DB-05 lee este valor así:
   *   new.raw_user_meta_data->>'full_name'
   *
   * Si cambias el nombre del campo aquí (por ejemplo a 'nombre'),
   * el trigger NO encontrará el valor y user_profiles.full_name
   * quedará como NULL.
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // ─── Registrar al usuario ───
    // signUp() crea un nuevo usuario en auth.users.
    //
    // El objeto `options.data` es la clave de integración con DB-05:
    //   - Se almacena en auth.users.raw_user_meta_data (JSONB)
    //   - El trigger handle_new_user() lee:
    //     new.raw_user_meta_data->>'full_name'
    //   - Y lo inserta en public.user_profiles.full_name
    //
    // CUIDADO: La propiedad DEBE llamarse exactamente `full_name`
    // (con guión bajo), no `fullName` (camelCase) ni `nombre`.
    // El trigger de PostgreSQL busca literalmente 'full_name'.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          // ← Este es el campo que el trigger de DB-05 lee.
          // Si lo llamas diferente, user_profiles.full_name será NULL.
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      // ❌ Error en el registro. Causas comunes:
      //   - "User already registered" → el email ya existe
      //   - "Password should be at least 6 characters"
      //   - "Email rate limit exceeded" → demasiados intentos
      //   - "Signup requires a valid password" → password vacío
      setError(signUpError.message);
      setLoading(false);
    } else {
      // ✅ Registro exitoso.
      //
      // COMPORTAMIENTO según config.toml de DB-05:
      //   Si enable_confirmations = false (desarrollo):
      //     → El usuario queda autenticado inmediatamente
      //     → Las cookies JWT se establecen
      //     → Podemos redirigir al dashboard
      //
      //   Si enable_confirmations = true (producción):
      //     → Supabase envía un email de confirmación
      //     → El usuario debe hacer click en el enlace
      //     → El enlace lo trae a /auth/callback (Paso C)
      //     → Ahí se establece la sesión
      //
      // En desarrollo (enable_confirmations = false), el flujo
      // es directo: registro → dashboard.
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <>
      {/* ──── Título y subtítulo ──── */}
      <h1 className="mb-2 text-2xl font-semibold text-foreground">Crear Cuenta</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Comienza tu viaje hacia la certificación ISTQB.
      </p>

      {/* ──── Formulario ──── */}
      <form onSubmit={handleRegister} className="space-y-4">
        {/* Campo: Nombre Completo */}
        {/* Este es el campo EXTRA que login no tiene.
            Su valor se envía a Supabase como options.data.full_name
            y el trigger de DB-05 lo captura para user_profiles.
        */}
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-foreground">
            Nombre Completo
          </Label>
          <Input
            id="fullName"
            type="text"
            placeholder="Ej. Juan Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="border-input bg-card text-foreground"
          />
        </div>

        {/* Campo: Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground">
            Correo Electrónico
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-input bg-card text-foreground"
          />
        </div>

        {/* Campo: Password */}
        {/* Nota: indicamos "(Mín. 6 caracteres)" en el label.
            Supabase tiene un mínimo de 6 caracteres por defecto.
            Si el usuario ingresa menos, recibirá el error:
            "Password should be at least 6 characters"
        */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-foreground">
            Contraseña (Mín. 6 caracteres)
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border-input bg-card text-foreground"
          />
        </div>

        {/* ──── Mensaje de error ──── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* ──── Botón de submit ──── */}
        {/* Usamos bg-blue-600 para diferenciar visualmente del login
            (que usa emerald). Esto le da una señal visual al usuario
            de que está en una pantalla diferente al login.
        */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700"
        >
          {loading ? "Creando cuenta..." : "Registrarse"}
        </Button>
      </form>

      {/* ──── Link al login ──── */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-blue-700 underline-offset-4 hover:text-blue-800 hover:underline">
          Inicia sesión
        </Link>
      </div>
    </>
  );
}
