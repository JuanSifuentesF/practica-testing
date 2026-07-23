export type ApiChecklistCategory =
  | "request"
  | "validation"
  | "error"
  | "response";

export interface ApiChecklistDefinition {
  id: string;
  category: ApiChecklistCategory;
  description: string;
  expectedResult: string;
  documentation: string;
}

export interface EndpointDefinition {
  id: "extract-pdf-full";
  method: "POST";
  path: "/extract-pdf-full";
  contentType: "multipart/form-data";
  requestField: "file";
  authentication: "Bearer BFF-to-backend";
  successShape: "FullExtractionResponse";
  errorShape: "ErrorResponse";
}

export interface ChecklistProgressItem {
  checked: boolean;
  actualResult: string;
}

export type ApiChecklistProgress = Record<string, ChecklistProgressItem>;

interface StoredApiChecklistProgress {
  version: 1;
  endpointId: EndpointDefinition["id"];
  progress: ApiChecklistProgress;
}

export const API_CHECKLIST_STORAGE_KEY =
  "istqb:api-testing:extract-pdf-full:v1";

export const EXTRACT_PDF_FULL_ENDPOINT: EndpointDefinition = {
  id: "extract-pdf-full",
  method: "POST",
  path: "/extract-pdf-full",
  contentType: "multipart/form-data",
  requestField: "file",
  authentication: "Bearer BFF-to-backend",
  successShape: "FullExtractionResponse",
  errorShape: "ErrorResponse",
};

export const EXTRACT_PDF_FULL_CHECKLIST: readonly ApiChecklistDefinition[] = [
  {
    id: "valid-pdf-200",
    category: "request",
    description:
      "Enviar un PDF valido con texto seleccionable en el campo multipart file.",
    expectedResult:
      "200 y FullExtractionResponse con topics, total_topics, warnings e is_complete.",
    documentation: "Valida flujo principal y respuesta completa.",
  },
  {
    id: "empty-file-400",
    category: "validation",
    description: "Enviar un archivo PDF vacio o sin bytes utiles.",
    expectedResult: "400 y ErrorResponse con detail y error_code.",
    documentation: "Rechazo de entrada invalida antes de extraer texto.",
  },
  {
    id: "wrong-extension-400",
    category: "validation",
    description:
      "Enviar bytes que no empiecen con %PDF- o un content type incompatible.",
    expectedResult: "400 y ErrorResponse; no se ejecuta el pipeline.",
    documentation:
      "El id es legacy: MIME y magic bytes son el oraculo, no la extension.",
  },
  {
    id: "scanned-pdf-422",
    category: "validation",
    description:
      "Enviar PDF escaneado sin texto seleccionable o sin topicos detectables.",
    expectedResult: "422 y ErrorResponse con detalle de extraccion.",
    documentation: "Distingue PDF valido de contenido no extraible.",
  },
  {
    id: "controlled-error-shape",
    category: "error",
    description: "Inspeccionar una respuesta de error controlado.",
    expectedResult:
      "400/401/413/422/429/500/503 preservado; JSON plano con detail y error_code.",
    documentation:
      "Sin detail anidado, stack, secreto BFF ni texto crudo de excepciones.",
  },
  {
    id: "success-response-shape",
    category: "response",
    description: "Inspeccionar la estructura de respuesta exitosa.",
    expectedResult:
      "filename, total_pages, extraction_method, topics, level_distribution, estimated_study_hours, warnings e is_complete.",
    documentation: "Contrato FullExtractionResponse que consume UP-03.",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProgressItem(value: unknown): value is ChecklistProgressItem {
  return (
    isRecord(value) &&
    typeof value.checked === "boolean" &&
    typeof value.actualResult === "string"
  );
}

export function createInitialApiChecklistProgress(): ApiChecklistProgress {
  return Object.fromEntries(
    EXTRACT_PDF_FULL_CHECKLIST.map((item) => [
      item.id,
      { checked: false, actualResult: "" },
    ]),
  );
}

export function parseApiChecklistProgress(
  value: unknown,
): ApiChecklistProgress | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (
    value.endpointId !== EXTRACT_PDF_FULL_ENDPOINT.id ||
    !isRecord(value.progress)
  )
    return null;
  const ids = EXTRACT_PDF_FULL_CHECKLIST.map((item) => item.id);
  if (Object.keys(value.progress).length !== ids.length) return null;

  const progress: ApiChecklistProgress = {};
  for (const id of ids) {
    const item = value.progress[id];
    if (!isProgressItem(item)) return null;
    progress[id] = { checked: item.checked, actualResult: item.actualResult };
  }
  return progress;
}

export function readApiChecklistProgress():
  | { kind: "empty" }
  | { kind: "valid"; progress: ApiChecklistProgress }
  | { kind: "invalid" }
  | { kind: "unavailable" } {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(API_CHECKLIST_STORAGE_KEY);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return { kind: "empty" };
  try {
    const progress = parseApiChecklistProgress(JSON.parse(raw));
    return progress ? { kind: "valid", progress } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

export function saveApiChecklistProgress(
  progress: ApiChecklistProgress,
): boolean {
  const value: StoredApiChecklistProgress = {
    version: 1,
    endpointId: "extract-pdf-full",
    progress,
  };
  try {
    window.localStorage.setItem(
      API_CHECKLIST_STORAGE_KEY,
      JSON.stringify(value),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearApiChecklistProgress(): boolean {
  try {
    window.localStorage.removeItem(API_CHECKLIST_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

const validFixture: StoredApiChecklistProgress = {
  version: 1,
  endpointId: "extract-pdf-full",
  progress: createInitialApiChecklistProgress(),
};
export const API_CHECKLIST_STORAGE_FIXTURES = [
  { name: "valido", value: validFixture, expected: true },
  { name: "legacy array", value: [], expected: false },
  {
    name: "campo requerido ausente",
    value: { version: 1, endpointId: "extract-pdf-full" },
    expected: false,
  },
  {
    name: "endpoint invalido",
    value: { ...validFixture, endpointId: "extract-pdf" },
    expected: false,
  },
  {
    name: "progreso vacio",
    value: { ...validFixture, progress: {} },
    expected: false,
  },
] as const;

export function assertApiChecklistStorageFixtures(): void {
  const failed = API_CHECKLIST_STORAGE_FIXTURES.filter(
    (fixture) =>
      (parseApiChecklistProgress(fixture.value) !== null) !== fixture.expected,
  );
  if (failed.length > 0)
    throw new Error(
      `Fixtures API checklist fallaron: ${failed.map((item) => item.name).join(", ")}`,
    );
}
