import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  throw new Error("Faltan variables server-only para el fixture de ownership");
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const owner = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ownerEmail = `ownership-a-${randomUUID()}@example.invalid`;
const otherEmail = `ownership-b-${randomUUID()}@example.invalid`;
const ownerPassword = `${randomUUID()}Aa1!`;
const otherPassword = `${randomUUID()}Aa1!`;
let ownerId = null;
let otherId = null;

async function createFixtureUser(email, password) {
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error || !result.data.user) {
    throw new Error("No se pudo crear un usuario del fixture de ownership");
  }
  return result.data.user.id;
}

async function insertFixture(table, row, label) {
  const result = await admin.from(table).insert(row).select("id").single();
  if (result.error || !result.data) {
    throw new Error(`${label} no pudo crear su fixture (${result.error?.code})`);
  }
  return result.data.id;
}

async function expectRejected(operation, expectedCodes, label) {
  const result = await operation;
  if (!result.error || !expectedCodes.includes(result.error.code)) {
    throw new Error(`${label} no fue rechazado por la capa esperada`);
  }
}

async function expectAllowed(operation, label) {
  const result = await operation;
  if (result.error) {
    throw new Error(`${label} rechazó una operación válida (${result.error.code})`);
  }
}

async function loadPreflightRows(table, columns) {
  const result = await admin.from(table).select(columns, { count: "exact" });
  if (result.error || !result.data || result.count === null) {
    throw new Error(`No se pudo inspeccionar ${table} durante el preflight`);
  }
  if (result.count !== result.data.length || result.count > 1000) {
    throw new Error(
      `${table} excede el límite seguro del preflight; requiere ventana de mantenimiento manual`,
    );
  }
  return result.data;
}

async function runPreflight() {
  const [documents, plans, sessions, answers, progress] = await Promise.all([
    loadPreflightRows("documents", "id,user_id"),
    loadPreflightRows("study_plans", "id,user_id,document_id"),
    loadPreflightRows("sessions", "id,user_id,study_plan_id"),
    loadPreflightRows(
      "answers",
      "id,user_id,session_id,correct_answer,user_answer,is_correct",
    ),
    loadPreflightRows("topic_progress", "id,user_id,study_plan_id"),
  ]);
  const documentOwners = new Map(
    documents.map((document) => [document.id, document.user_id]),
  );
  const planOwners = new Map(plans.map((plan) => [plan.id, plan.user_id]));
  const sessionOwners = new Map(
    sessions.map((session) => [session.id, session.user_id]),
  );
  const violations =
    plans.filter((plan) => documentOwners.get(plan.document_id) !== plan.user_id)
      .length +
    sessions.filter(
      (session) => planOwners.get(session.study_plan_id) !== session.user_id,
    ).length +
    answers.filter(
      (answer) => sessionOwners.get(answer.session_id) !== answer.user_id,
    ).length +
    answers.filter(
      (answer) =>
        answer.is_correct !== (answer.user_answer === answer.correct_answer),
    ).length +
    progress.filter(
      (topic) => planOwners.get(topic.study_plan_id) !== topic.user_id,
    ).length;

  if (violations > 0) {
    throw new Error(`Preflight detectó ${violations} violaciones de integridad`);
  }
  console.log(
    `PASS ownership preflight: documents=${documents.length}, plans=${plans.length}, sessions=${sessions.length}, answers=${answers.length}, progress=${progress.length}, violations=0`,
  );
}

async function cleanupFixtureData() {
  const errors = [];
  const signOut = await owner.auth.signOut();
  if (signOut.error) errors.push("signout");

  const ids = [ownerId, otherId].filter(Boolean);
  if (ids.length > 0) {
    for (const table of [
      "answers",
      "topic_progress",
      "sessions",
      "study_plans",
      "documents",
    ]) {
      const deletion = await admin.from(table).delete().in("user_id", ids);
      if (deletion.error) errors.push(`delete:${table}`);
    }

    for (const table of [
      "answers",
      "topic_progress",
      "sessions",
      "study_plans",
      "documents",
    ]) {
      const remaining = await admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .in("user_id", ids);
      if (remaining.error || remaining.count !== 0) {
        errors.push(`verify:${table}`);
      }
    }
  }

  for (const id of ids) {
    const deletion = await admin.auth.admin.deleteUser(id);
    if (deletion.error) errors.push("delete:auth-user");
  }
  if (errors.length > 0) {
    throw new Error(`Cleanup incompleto del fixture de ownership: ${errors.join(",")}`);
  }
}

async function runRemoteFixture() {
  let passed = false;
  try {
  ownerId = await createFixtureUser(ownerEmail, ownerPassword);
  otherId = await createFixtureUser(otherEmail, otherPassword);

  const signedIn = await owner.auth.signInWithPassword({
    email: ownerEmail,
    password: ownerPassword,
  });
  if (signedIn.error) throw new Error("No se pudo autenticar el usuario A");

  const documentA = await insertFixture(
    "documents",
    {
      user_id: ownerId,
      file_name: "owner-a.pdf",
      file_url: `${ownerId}/owner-a.pdf`,
    },
    "Documento A",
  );
  const documentB = await insertFixture(
    "documents",
    {
      user_id: otherId,
      file_name: "owner-b.pdf",
      file_url: `${otherId}/owner-b.pdf`,
    },
    "Documento B",
  );

  const planA = await insertFixture(
    "study_plans",
    {
      user_id: ownerId,
      document_id: documentA,
      start_date: "2026-07-19",
      estimated_end_date: "2026-07-26",
      plan_json: {},
    },
    "Plan A",
  );
  const planB = await insertFixture(
    "study_plans",
    {
      user_id: otherId,
      document_id: documentB,
      start_date: "2026-07-19",
      estimated_end_date: "2026-07-26",
      plan_json: {},
    },
    "Plan B",
  );

  const sessionA = await insertFixture(
    "sessions",
    {
      study_plan_id: planA,
      user_id: ownerId,
      topic_codes: ["FL-1.1.1"],
      session_type: "morning",
      day_number: 1,
    },
    "Sesión A",
  );
  const sessionB = await insertFixture(
    "sessions",
    {
      study_plan_id: planB,
      user_id: otherId,
      topic_codes: ["FL-1.1.1"],
      session_type: "morning",
      day_number: 1,
    },
    "Sesión B",
  );

  await expectRejected(
    owner.from("documents").insert({
      user_id: ownerId,
      file_name: "owner-valid.pdf",
      file_url: `${ownerId}/owner-valid.pdf`,
    }),
    ["42501"],
    "Privilegios server-only documents A/A",
  );
  await expectRejected(
    owner.from("study_plans").insert({
      user_id: ownerId,
      document_id: documentA,
      start_date: "2026-07-19",
      estimated_end_date: "2026-07-26",
      plan_json: {},
    }),
    ["42501"],
    "Privilegios server-only study_plans A/A",
  );
  await expectRejected(
    owner.from("sessions").insert({
      study_plan_id: planA,
      user_id: ownerId,
      topic_codes: ["FL-1.1.1"],
      session_type: "night",
      day_number: 1,
    }),
    ["42501"],
    "Privilegios server-only sessions A/A",
  );
  await expectRejected(
    owner.from("answers").insert({
      session_id: sessionA,
      user_id: ownerId,
      question_text: "Same-tenant question",
      options_json: { a: "A", b: "B", c: "C", d: "D" },
      correct_answer: "a",
      user_answer: "a",
      is_correct: true,
      topic_code: "FL-1.1.1",
      level_k: "K1",
    }),
    ["42501"],
    "Privilegios server-only answers A/A",
  );
  await expectRejected(
    owner.from("topic_progress").insert({
      user_id: ownerId,
      study_plan_id: planA,
      topic_code: "FL-3.1.1",
      status: "pending",
    }),
    ["42501"],
    "Privilegios server-only topic_progress A/A",
  );
  await expectRejected(
    owner
      .from("study_plans")
      .update({ estimated_end_date: "2026-07-27" })
      .eq("id", planA),
    ["42501"],
    "Privilegios server-only update study_plans A/A",
  );
  await expectRejected(
    owner.from("sessions").update({ status: "active" }).eq("id", sessionA),
    ["42501"],
    "Privilegios server-only update sessions A/A",
  );

  await expectAllowed(
    admin.from("answers").insert({
      session_id: sessionA,
      user_id: ownerId,
      question_text: "Server-authoritative same-tenant question",
      options_json: { a: "AAA", b: "BBB", c: "CCC", d: "DDD" },
      correct_answer: "a",
      user_answer: "a",
      is_correct: true,
      topic_code: "FL-1.1.1",
      level_k: "K1",
    }),
    "service_role answers/session A/A",
  );
  await expectAllowed(
    admin.from("topic_progress").insert({
      user_id: ownerId,
      study_plan_id: planA,
      topic_code: "FL-3.1.1",
      status: "pending",
    }),
    "service_role topic_progress/plan A/A",
  );

  await expectRejected(
    owner.from("documents").insert({
      user_id: otherId,
      file_name: "forged.pdf",
      file_url: `${otherId}/forged.pdf`,
    }),
    ["42501"],
    "RLS documents A/B",
  );

  const crossPlan = {
    id: randomUUID(),
    user_id: ownerId,
    document_id: documentB,
    start_date: "2026-07-19",
    estimated_end_date: "2026-07-26",
    plan_json: {},
  };
  await expectRejected(
    owner.from("study_plans").insert(crossPlan),
    ["42501"],
    "RLS study_plans/document A/B",
  );
  await expectRejected(
    admin.from("study_plans").insert(crossPlan),
    ["23503"],
    "FK study_plans/document A/B",
  );

  const crossSession = {
    id: randomUUID(),
    study_plan_id: planB,
    user_id: ownerId,
    topic_codes: ["FL-1.1.1"],
    session_type: "night",
    day_number: 1,
  };
  await expectRejected(
    owner.from("sessions").insert(crossSession),
    ["42501"],
    "RLS sessions/plan A/B",
  );
  await expectRejected(
    admin.from("sessions").insert(crossSession),
    ["23503"],
    "FK sessions/plan A/B",
  );

  const crossAnswer = {
    id: randomUUID(),
    session_id: sessionB,
    user_id: ownerId,
    question_text: "Cross-tenant question",
    options_json: { a: "A", b: "B", c: "C", d: "D" },
    correct_answer: "a",
    user_answer: "a",
    is_correct: true,
    topic_code: "FL-1.1.1",
    level_k: "K1",
  };
  await expectRejected(
    owner.from("answers").insert(crossAnswer),
    ["42501"],
    "RLS answers/session A/B",
  );
  await expectRejected(
    admin.from("answers").insert(crossAnswer),
    ["23503"],
    "FK answers/session A/B",
  );

  const crossProgress = {
    id: randomUUID(),
    user_id: ownerId,
    study_plan_id: planB,
    topic_code: "FL-2.1.1",
    status: "pending",
  };
  await expectRejected(
    owner.from("topic_progress").insert(crossProgress),
    ["42501"],
    "RLS topic_progress/plan A/B",
  );
  await expectRejected(
    admin.from("topic_progress").insert(crossProgress),
    ["23503"],
    "FK topic_progress/plan A/B",
  );

  await expectRejected(
    owner.from("study_plans").update({ document_id: documentB }).eq("id", planA),
    ["42501"],
    "RLS update study_plans/document A/B",
  );
  await expectRejected(
    admin.from("sessions").update({ study_plan_id: planB }).eq("id", sessionA),
    ["23503"],
    "FK update sessions/plan A/B",
  );

    passed = true;
  } finally {
    await cleanupFixtureData();
  }
  if (passed) {
    console.log(
      "PASS core ownership: authenticated DML denied; service_role A/A allowed; composite FKs reject A/B",
    );
  }
}

if (process.argv.includes("--preflight")) {
  await runPreflight();
} else {
  await runRemoteFixture();
}
