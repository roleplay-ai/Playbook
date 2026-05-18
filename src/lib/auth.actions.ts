"use server";

import { z } from "zod";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_USERNAME = "gaurav";
const ADMIN_PASSWORD = "nudge2026";
const EMAIL_DOMAIN = "audit.nudgeable.local";

export async function ensureAdmin() {
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", ADMIN_USERNAME)
    .maybeSingle();
  if (existing) return { ok: true };

  const email = `${ADMIN_USERNAME}@${EMAIL_DOMAIN}`;
  const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (cErr || !created.user) {
    console.error("admin create failed", cErr);
    return { ok: false, error: cErr?.message };
  }
  const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
    { id: created.user.id, username: ADMIN_USERNAME, is_admin: true },
    { onConflict: "id" }
  );
  if (pErr) console.error("admin profile insert failed", pErr);
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
