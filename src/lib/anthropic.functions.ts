import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fallbackTool } from "@/lib/constants";

const Input = z.object({
  activities: z.array(z.object({
    id: z.string(),
    name: z.string().max(500),
    role: z.string().max(120),
    capabilities: z.array(z.string()).max(20),
    weekly_hours: z.number().min(0).max(168),
    ai_capable: z.enum(["yes", "partly", "no"]),
  })).max(20),
});

export type AiBullet = { text: string; hours_saved: number };
type Reco = {
  id: string;
  tool: string;
  how_to: string;
  bullets: AiBullet[];
  total_saved: number;
  clarity: "clear" | "vague";
};

function isVague(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (n.length < 4) return true;
  if (n.split(/\s+/).length < 2) return true;
  return false;
}

async function recommendOne(act: z.infer<typeof Input>["activities"][number]): Promise<Reco> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const vague = isVague(act.name);

  if (vague) {
    return {
      id: act.id,
      tool: "",
      how_to: "",
      bullets: [],
      total_saved: 0,
      clarity: "vague",
    };
  }

  if (!apiKey || act.ai_capable === "no") {
    const fb = fallbackTool(act.capabilities);
    return {
      id: act.id, tool: fb.tool, how_to: fb.how_to,
      bullets: [], total_saved: 0,
      clarity: act.ai_capable === "no" ? "clear" : "clear",
    };
  }

  const prompt = `You advise knowledge workers on practical AI use. Given a single work activity, output specific AI use-cases mapped to THAT activity (not generic productivity advice).

Activity: ${act.name}
Role: ${act.role}
Weekly hours spent: ${act.weekly_hours}
Can AI do this: ${act.ai_capable}

First, judge clarity. If the activity is too vague/short/ambiguous to give specific advice (e.g. "act", "work", "stuff", "meetings"), set clarity="vague" and return empty bullets.

Otherwise, set clarity="clear" and return 2-4 highly specific bullets. Each bullet must:
- name a concrete sub-task inside THIS activity
- say exactly how AI helps
- estimate hours_saved per week (decimal, realistic, summing to ≤ ${act.weekly_hours})

Also recommend ONE tool from: Claude Chat, Claude Project, Claude Skill, Claude Artifact, NotebookLM, Gemini, Google AI Studio, Lovable, Pabbly/n8n, VAPI.

Return JSON only:
{"clarity":"clear|vague","tool":"...","bullets":[{"text":"...","hours_saved":0.5}]}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content?.find(c => c.type === "text")?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as {
      clarity?: string; tool?: string; bullets?: Array<{ text: string; hours_saved: number }>;
    };
    const clarity = parsed.clarity === "vague" ? "vague" : "clear";
    const bullets = (parsed.bullets ?? []).slice(0, 4).map(b => ({
      text: String(b.text ?? "").slice(0, 300),
      hours_saved: Math.max(0, Math.min(Number(b.hours_saved) || 0, act.weekly_hours)),
    }));
    const total_saved = Math.min(
      bullets.reduce((s, b) => s + b.hours_saved, 0),
      act.weekly_hours,
    );
    const how_to = bullets.map(b => `• ${b.text} (~${b.hours_saved.toFixed(1)} hrs/wk)`).join("\n");
    return {
      id: act.id,
      tool: parsed.tool ?? "",
      how_to,
      bullets,
      total_saved,
      clarity,
    };
  } catch (e) {
    console.error("anthropic failed", e);
    const fb = fallbackTool(act.capabilities);
    return { id: act.id, tool: fb.tool, how_to: fb.how_to, bullets: [], total_saved: 0, clarity: "clear" };
  }
}

export const recommendTools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const results = await Promise.all(data.activities.map(recommendOne));
    return { results };
  });
