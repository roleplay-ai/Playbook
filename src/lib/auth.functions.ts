import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_USERNAME = "gaurav";
const ADMIN_PASSWORD = "nudge2026";
const EMAIL_DOMAIN = "audit.nudgeable.local";

export const ensureAdmin = createServerFn({ method: "POST" }).handler(async () => {
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
  // upsert: nudgeable's on_auth_user_created trigger auto-creates the base profile row,
  // so a plain insert would conflict on the primary key.
  const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
    id: created.user.id,
    username: ADMIN_USERNAME,
    is_admin: true,
    role: "Admin",
  }, { onConflict: "id" });
  if (pErr) console.error("admin profile insert failed", pErr);
  return { ok: true };
});

export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

// Public — list companies for the entry dropdown (no auth required)
export const listCompaniesPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id,name")
    .order("name");
  if (error) return { ok: false, error: error.message, companies: [] as Array<{ id: string; name: string }> };
  return { ok: true, companies: (data ?? []) as Array<{ id: string; name: string }> };
});

// Derive a stable password from email so the client can sign in after the
// server creates the auth user. Workshop tool — not for sensitive accounts.
function passwordFor(email: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret";
  return createHmac("sha256", secret).update(email.toLowerCase()).digest("hex").slice(0, 32);
}

const EnterInput = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  company_id: z.string().uuid(),
});

export const enterAudit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EnterInput.parse(input))
  .handler(async ({ data }) => {
    const email = data.email;
    const password = passwordFor(email);

    // Check existing profile by username (= email)
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("username", email)
      .maybeSingle();

    if (existing) {
      // Keep company up to date if it changed
      if (existing.company_id !== data.company_id) {
        await supabaseAdmin
          .from("profiles")
          .update({ company_id: data.company_id })
          .eq("id", existing.id);
      }
      return { ok: true, email, password };
    }

    // Create auth user
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (cErr || !created.user) {
      return { ok: false, error: cErr?.message ?? "Could not create account" };
    }
    // upsert: nudgeable's on_auth_user_created trigger auto-creates the base profile row,
    // so a plain insert would conflict on the primary key.
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      username: email,
      company_id: data.company_id,
      role: "Other",
      is_admin: false,
    }, { onConflict: "id" });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: pErr.message };
    }
    return { ok: true, email, password };
  });
