"use client";

// ─────────────────────────────────────────────────────────────────
// [topicCode]/_components/test-case-editor.tsx
// Tabla editable interactiva para diseñar casos de prueba.
//
// TIPO: Client Component (altamente interactivo — inputs, state).
//
// COLUMNAS:
//   ID | Escenario | Dato de prueba | Resultado esperado | Tipo
//
// FUNCIONALIDADES:
//   1. Agregar filas con botón "+" (genera ID secuencial TC-001, TC-002...)
//   2. Eliminar filas con botón "×" por fila
//   3. Editar cada celda inline (inputs controlados)
//   4. Seleccionar tipo (positive/negative/boundary) con dropdown
//   5. Validación: mínimo de filas requeridas según constraints
//   6. Los datos se mantienen al navegar entre campos (tab/click)
//
// ESTADO:
//   Controlado por el padre (page.tsx) via props rows + onRowsChange.
//   Esto es un "Controlled Component" — el padre es la fuente de verdad.
//   Esto facilita el envío de datos y la integración con PL-09.
//
// DISEÑO:
//   - Fondo oscuro con bordes sutiles (consistente con dashboard)
//   - Inputs inline con estilo minimal
//   - Dropdown para tipo con colores semánticos
//   - Hover effects en filas
//   - Responsive: tabla con scroll horizontal en mobile
// ─────────────────────────────────────────────────────────────────

import { Plus, Trash2, Pencil } from "lucide-react";
import type { TestCaseRow, TestCaseType } from "@/types/practice";

// ─── Props ────────────────────────────────────────────────────

export interface TestCaseEditorProps {
  /** Array de filas actuales (controlado por el padre) */
  rows: TestCaseRow[];
  /** Callback cuando cambian las filas */
  onRowsChange: (rows: TestCaseRow[]) => void;
  /** Mínimo de filas requeridas (extraído de constraints del ejercicio) */
  minRows: number;
  /** Si el editor está deshabilitado (ej. durante envío) */
  disabled?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────

/** Opciones de tipo de test case con labels y colores */
const TYPE_OPTIONS: { value: TestCaseType; label: string; color: string }[] = [
  {
    value: "positive",
    label: "Positivo",
    color: "text-emerald-400 bg-emerald-500/10",
  },
  {
    value: "negative",
    label: "Negativo",
    color: "text-rose-400 bg-rose-500/10",
  },
  {
    value: "boundary",
    label: "Límite",
    color: "text-amber-400 bg-amber-500/10",
  },
];

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Genera el siguiente ID secuencial de test case.
 * Formato: TC-001, TC-002, ..., TC-099, TC-100
 */
function generateNextId(rows: TestCaseRow[]): string {
  if (rows.length === 0) return "TC-001";

  // Extraer el mayor número existente
  let maxNum = 0;
  for (const row of rows) {
    const match = row.id.match(/^TC-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `TC-${String(maxNum + 1).padStart(3, "0")}`;
}

/**
 * Crea una fila vacía con el ID generado automáticamente.
 */
function createEmptyRow(rows: TestCaseRow[]): TestCaseRow {
  return {
    id: generateNextId(rows),
    scenario: "",
    test_data: "",
    expected_result: "",
    type: "positive",
  };
}

// ─── Componente ───────────────────────────────────────────────

export function TestCaseEditor({
  rows,
  onRowsChange,
  minRows,
  disabled = false,
}: TestCaseEditorProps) {
  // ─── Handlers ───────────────────────────────────────────

  /** Agregar una nueva fila al final */
  function handleAddRow() {
    const newRow = createEmptyRow(rows);
    onRowsChange([...rows, newRow]);
  }

  /** Eliminar una fila por índice */
  function handleRemoveRow(index: number) {
    const updated = rows.filter((_, i) => i !== index);
    onRowsChange(updated);
  }

  /** Actualizar un campo de una fila específica */
  function handleCellChange(
    index: number,
    field: keyof TestCaseRow,
    value: string,
  ) {
    const updated = rows.map((row, i) =>
      i === index ? { ...row, [field]: value } : row,
    );
    onRowsChange(updated);
  }

  // ─── Validación visual ──────────────────────────────────
  const currentCount = rows.length;
  const isValid = currentCount >= minRows;
  // Contar filas con al menos escenario y resultado rellenos
  const completedCount = rows.filter(
    (r) => r.scenario.trim() !== "" && r.expected_result.trim() !== "",
  ).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Pencil className="size-4 text-brand-400" />
          <h2 className="text-sm font-semibold text-white">
            Tus Casos de Prueba
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Contador de filas */}
          <span
            className={`text-xs font-medium ${isValid ? "text-emerald-400" : "text-amber-400"}`}
          >
            {completedCount}/{minRows} mínimo
          </span>

          {/* Botón agregar fila */}
          <button
            onClick={handleAddRow}
            disabled={disabled}
            className="
              flex items-center gap-1 px-3 py-1.5
              text-xs font-semibold rounded-lg
              bg-brand-500/10 text-brand-400 border border-brand-500/20
              hover:bg-brand-500/20 hover:border-brand-500/40
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors cursor-pointer
            "
          >
            <Plus className="size-3.5" />
            Agregar fila
          </button>
        </div>
      </div>

      {/* ─── Tabla ─── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Encabezado */}
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-20">
                ID
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Escenario
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Dato de Prueba
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Resultado Esperado
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">
                Tipo
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">
                {/* Columna para botón eliminar */}
              </th>
            </tr>
          </thead>

          {/* Cuerpo de la tabla */}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  No hay filas. Haz click en{" "}
                  <span className="text-brand-400 font-medium">
                    &quot;Agregar fila&quot;
                  </span>{" "}
                  para comenzar.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id + "-" + index}
                  className="
                    border-b border-slate-800/50
                    hover:bg-slate-800/30 transition-colors
                    group
                  "
                >
                  {/* ID (solo lectura) */}
                  <td className="px-3 py-1.5">
                    <span className="text-xs font-mono text-slate-500">
                      {row.id}
                    </span>
                  </td>

                  {/* Escenario (editable) */}
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={row.scenario}
                      onChange={(e) =>
                        handleCellChange(index, "scenario", e.target.value)
                      }
                      disabled={disabled}
                      placeholder="Descripción del escenario..."
                      className="
                        w-full bg-transparent border-0 outline-none
                        text-sm text-slate-200 placeholder-slate-600
                        focus:ring-1 focus:ring-brand-500/50 rounded px-1.5 py-1
                        disabled:opacity-50
                      "
                    />
                  </td>

                  {/* Dato de prueba (editable) */}
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={row.test_data}
                      onChange={(e) =>
                        handleCellChange(index, "test_data", e.target.value)
                      }
                      disabled={disabled}
                      placeholder="Valor de entrada..."
                      className="
                        w-full bg-transparent border-0 outline-none
                        text-sm text-slate-200 placeholder-slate-600
                        focus:ring-1 focus:ring-brand-500/50 rounded px-1.5 py-1
                        disabled:opacity-50
                      "
                    />
                  </td>

                  {/* Resultado esperado (editable) */}
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={row.expected_result}
                      onChange={(e) =>
                        handleCellChange(
                          index,
                          "expected_result",
                          e.target.value,
                        )
                      }
                      disabled={disabled}
                      placeholder="Resultado esperado..."
                      className="
                        w-full bg-transparent border-0 outline-none
                        text-sm text-slate-200 placeholder-slate-600
                        focus:ring-1 focus:ring-brand-500/50 rounded px-1.5 py-1
                        disabled:opacity-50
                      "
                    />
                  </td>

                  {/* Tipo (dropdown) */}
                  <td className="px-3 py-1.5">
                    <select
                      value={row.type}
                      onChange={(e) =>
                        handleCellChange(
                          index,
                          "type",
                          e.target.value as TestCaseType,
                        )
                      }
                      disabled={disabled}
                      className={`
                        w-full bg-slate-800 border border-slate-700
                        rounded px-2 py-1 text-xs font-medium
                        outline-none focus:ring-1 focus:ring-brand-500/50
                        disabled:opacity-50 cursor-pointer
                        ${TYPE_OPTIONS.find((o) => o.value === row.type)?.color ?? "text-slate-400"}
                      `}
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Botón eliminar */}
                  <td className="px-3 py-1.5 text-center">
                    <button
                      onClick={() => handleRemoveRow(index)}
                      disabled={disabled}
                      title="Eliminar fila"
                      className="
                        opacity-0 group-hover:opacity-100
                        p-1 rounded text-slate-600
                        hover:text-red-400 hover:bg-red-500/10
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-all cursor-pointer
                      "
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Footer con validación ─── */}
      {rows.length > 0 && !isValid && (
        <div className="px-4 py-2.5 border-t border-slate-800 bg-amber-950/20">
          <p className="text-xs text-amber-400">
            ⚠️ Necesitas al menos {minRows} filas con escenario y resultado
            completados. Actualmente tienes {completedCount}.
          </p>
        </div>
      )}
    </div>
  );
}
