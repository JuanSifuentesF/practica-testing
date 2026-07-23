import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.PDF_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const sourceDocumentId = process.argv
  .find((argument) => argument.startsWith("--source-document-id="))
  ?.split("=", 2)[1];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sourceDocumentId) {
  throw new Error("Falta --source-document-id para el fixture E2E");
}
if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Faltan variables server-only de Supabase para el fixture E2E");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const cookies = new Map();
const authClient = createServerClient(supabaseUrl, anonKey, {
  cookies: {
    getAll() {
      return [...cookies].map(([name, value]) => ({ name, value }));
    },
    setAll(values) {
      for (const { name, value, options } of values) {
        if (options.maxAge === 0) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
  },
});

let userId = null;
let uploadedDocumentId = null;
let uploadedStoragePath = null;
const result = {
  user_created: false,
  upload_status: null,
  extract_status: null,
  total_topics: null,
  persisted: false,
  cleanup_complete: false,
};

function cookieHeader() {
  return [...cookies]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

async function responseError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const code =
    payload && typeof payload === "object"
      ? payload.error_code ?? payload.code ?? "UNKNOWN_ERROR"
      : "NON_JSON_ERROR";
  return new Error(`HTTP ${response.status} ${String(code)}`);
}

try {
  const email = `pdf-e2e-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "PDF E2E Fixture" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`No se pudo crear usuario (${created.error?.code ?? "unknown"})`);
  }
  userId = created.data.user.id;
  result.user_created = true;

  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session || cookies.size === 0) {
    throw new Error(`No se pudo autenticar fixture (${signedIn.error?.code ?? "unknown"})`);
  }

  const source = await admin
    .from("documents")
    .select("file_url, file_name")
    .eq("id", sourceDocumentId)
    .maybeSingle();
  if (source.error || !source.data) {
    throw new Error(`No se encontró PDF fuente (${source.error?.code ?? "not_found"})`);
  }

  const signedUrl = await admin.storage
    .from("pdfs")
    .createSignedUrl(source.data.file_url, 120);
  if (signedUrl.error || !signedUrl.data?.signedUrl) {
    throw new Error("No se pudo firmar el PDF fuente");
  }

  const storedPdf = await fetch(signedUrl.data.signedUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!storedPdf.ok) throw new Error(`Storage respondió ${storedPdf.status}`);
  const pdfBytes = await storedPdf.arrayBuffer();

  const uploadBody = new FormData();
  uploadBody.append(
    "file",
    new Blob([pdfBytes], { type: "application/pdf" }),
    source.data.file_name,
  );
  uploadBody.append("objective_days", "7");
  uploadBody.append("morning_time", "08:00");
  uploadBody.append("night_time", "20:00");

  const uploadResponse = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: { Cookie: cookieHeader() },
    body: uploadBody,
    signal: AbortSignal.timeout(30_000),
  });
  result.upload_status = uploadResponse.status;
  if (!uploadResponse.ok) throw await responseError(uploadResponse);
  const uploadPayload = await uploadResponse.json();
  uploadedDocumentId = uploadPayload.document_id;

  const uploadedDocument = await admin
    .from("documents")
    .select("user_id, file_url")
    .eq("id", uploadedDocumentId)
    .maybeSingle();
  if (
    uploadedDocument.error ||
    !uploadedDocument.data ||
    uploadedDocument.data.user_id !== userId
  ) {
    throw new Error("El documento subido no pertenece al usuario temporal");
  }
  uploadedStoragePath = uploadedDocument.data.file_url;

  const extractResponse = await fetch(`${baseUrl}/api/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(),
    },
    body: JSON.stringify({ document_id: uploadedDocumentId }),
    signal: AbortSignal.timeout(45_000),
  });
  result.extract_status = extractResponse.status;
  if (!extractResponse.ok) throw await responseError(extractResponse);
  const extraction = await extractResponse.json();
  result.total_topics = extraction.total_topics;

  const persisted = await admin
    .from("documents")
    .select("topics_json, extracted_text")
    .eq("id", uploadedDocumentId)
    .maybeSingle();
  result.persisted = Boolean(
    !persisted.error &&
      persisted.data?.topics_json &&
      persisted.data?.extracted_text,
  );

  if (
    result.total_topics !== 64 ||
    extraction.contract_version !== 2 ||
    extraction.is_complete !== true ||
    extraction.warnings.length !== 0 ||
    !result.persisted
  ) {
    throw new Error("La extracción no conservó el contrato exacto de 64 tópicos");
  }
} finally {
  const cleanupErrors = [];
  if (uploadedStoragePath) {
    const storageCleanup = await admin.storage
      .from("pdfs")
      .remove([uploadedStoragePath]);
    if (storageCleanup.error) cleanupErrors.push("storage");
  }
  if (uploadedDocumentId) {
    const documentCleanup = await admin
      .from("documents")
      .delete()
      .eq("id", uploadedDocumentId);
    if (documentCleanup.error) cleanupErrors.push("document");
  }
  if (userId) {
    const userCleanup = await admin.auth.admin.deleteUser(userId);
    if (userCleanup.error) cleanupErrors.push("user");
  }
  result.cleanup_complete = cleanupErrors.length === 0;
  console.log(JSON.stringify(result));
  if (cleanupErrors.length > 0) {
    throw new Error(`Cleanup E2E incompleto: ${cleanupErrors.join(",")}`);
  }
}
