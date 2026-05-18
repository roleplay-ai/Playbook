"use server";

import { z } from "zod";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_USERNAME = "gaurav";
const ADMIN_PASSWORD = "nudge2026";
const EMAIL_DOMAIN = "audit.nudgeable.local";

export async function signInFacilitator(username: string) {
  const name = username.trim().toLowerCase();

  // Email-style login (e.g. superadmin@nudgeapp): look up Supabase auth user by
  // that email, then verify their profile is_admin flag.
  if (name.includes("@")) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authUser = users.find((u) => u.email?.toLowerCase() === name);
    if (!authUser) {
      return { ok: false, error: "No facilitator account found with that email." };
    }
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", authUser.id)
      .maybeSingle();
    if (!profile?.is_admin) {
      return { ok: false, error: "This account does not have facilitator access." };
    }
    return { ok: true, email: name };
  }

  // Short-name login (e.g. gaurav): look up by username in profiles, derive domain email.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, is_admin")
    .eq("username", name)
    .maybeSingle();

  if (!profile) {
    return { ok: false, error: "No facilitator account found with that username." };
  }
  if (!profile.is_admin) {
    return { ok: false, error: "This account does not have facilitator access." };
  }
  return { ok: true, email: `${name}@${EMAIL_DOMAIN}` };
}

async function ensureAdminAccount(email: string, password: string | null, username: string) {
  // Check if a profile already exists for this username
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, is_admin")
    .eq("username", username)
    .maybeSingle();

  if (existingProfile) {
    if (!existingProfile.is_admin) {
      await supabaseAdmin.from("profiles").update({ is_admin: true }).eq("id", existingProfile.id);
    }
    return { ok: true };
  }

  // Check if a Supabase auth user already exists with this email
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existingAuthUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existingAuthUser) {
    // Auth user exists but has no admin profile — link it
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
      { id: existingAuthUser.id, username, is_admin: true },
      { onConflict: "id" }
    );
    if (pErr) console.error("admin profile link failed", pErr);
    return { ok: true };
  }

  // Auth user doesn't exist — create from scratch (requires password)
  if (!password) {
    console.warn("ensureAdminAccount: no auth user found for", email, "and no password provided; skipping");
    return { ok: false, error: "Auth user not found" };
  }

  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) {
    console.error("admin create failed", email, cErr);
    return { ok: false, error: cErr?.message };
  }
  const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
    { id: created.user.id, username, is_admin: true },
    { onConflict: "id" }
  );
  if (pErr) console.error("admin profile insert failed", pErr);
  return { ok: true };
}

export async function ensureAdmin() {
  // Legacy default admin (short-username style)
  await ensureAdminAccount(
    `${ADMIN_USERNAME}@${EMAIL_DOMAIN}`,
    ADMIN_PASSWORD,
    ADMIN_USERNAME
  );

  // Additional facilitator from env — set FACILITATOR_EMAIL in .env.local.
  // If the Supabase auth user already exists, no password needed (profile is auto-linked).
  // If it doesn't exist yet, also set FACILITATOR_PASSWORD to create it.
  const facEmail = process.env.FACILITATOR_EMAIL;
  if (facEmail) {
    await ensureAdminAccount(facEmail, process.env.FACILITATOR_PASSWORD ?? null, facEmail);
  }

  return { ok: true };
}

export async function listCompaniesPublic() {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id,name")
    .order("name");
  if (error) return { ok: false, error: error.message, companies: [] as Array<{ id: string; name: string }> };
  return { ok: true, companies: (data ?? []) as Array<{ id: string; name: string }> };
}

function passwordFor(email: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret";
  return createHmac("sha256", secret).update(email.toLowerCase()).digest("hex").slice(0, 32);
}

const EnterInput = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  company_id: z.string().uuid(),
});

export async function enterAudit(input: { email: string; company_id: string }) {
  const data = EnterInput.parse(input);
  const email = data.email;
  const password = passwordFor(email);

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, company_id")
    .eq("username", email)
    .maybeSingle();

  if (existing) {
    if (existing.company_id !== data.company_id) {
      await supabaseAdmin
        .from("profiles")
        .update({ company_id: data.company_id })
        .eq("id", existing.id);
    }
    return { ok: true, email, password };
  }

  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) {
    return { ok: false, error: cErr?.message ?? "Could not create account" };
  }
  const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
    { id: created.user.id, username: email, company_id: data.company_id, is_admin: false },
    { onConflict: "id" }
  );
  if (pErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: pErr.message };
  }
  return { ok: true, email, password };
}
