// Supabase Edge Function: decode
// Decodes a term (mode "one") or picks new terms out of notes (mode "scan"),
// using the signed-in person's own word bank and recent conversations as context.
// Secrets it needs (Edge Functions > Secrets): ANTHROPIC_API_KEY
// Optional: ANTHROPIC_MODEL (defaults to claude-haiku-5-5)

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const TAGS = ["Finance", "Accounting", "Deals", "Real estate", "Legal", "Operations", "Sales", "Marketing", "Tech", "Tax", "Industry", "Other"];

type Term = { term?: string; aliases?: string[]; plain?: string; context?: string; mastered?: boolean; heard?: number };
type Call = { date?: string; context?: string; call?: string; elevated?: string; askedNext?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "The owner hasn't added an AI key yet." }, 500);

  // Act as the signed-in person, so row-level security limits reads to their own rows.
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return json({ error: "Sign in first." }, 401);

  let body: { mode?: string; input?: string; notes?: string; context?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const mode = body.mode === "scan" ? "scan" : "one";
  const input = String(body.input ?? "").slice(0, mode === "scan" ? 8000 : 1500);
  const notes = String(body.notes ?? "").slice(0, 1500);
  const ctx = String(body.context ?? "").slice(0, 80) || "general business";
  if (!input.trim()) return json({ error: "Nothing to decode." }, 400);

  // The word bank: everything this person has saved, plus their latest conversations.
  const [{ data: termRows }, { data: callRows }] = await Promise.all([
    sb.from("docs").select("data").eq("collection", "terms").limit(2000),
    sb.from("docs").select("data").eq("collection", "calls").order("updated_at", { ascending: false }).limit(8),
  ]);
  const bank = (termRows ?? []).map((r) => r.data as Term).filter((t) => t.term);
  bank.sort((a, b) => Number(b.heard ?? 0) - Number(a.heard ?? 0));
  const bankLines = bank.slice(0, 400).map((t) =>
    `- ${t.term}${t.aliases?.length ? ` (${t.aliases.join(", ")})` : ""}${t.context ? ` [${t.context}]` : ""}${t.mastered ? " {known}" : ""}: ${String(t.plain ?? "").slice(0, 140)}`
  );
  const recent = (callRows ?? []).map((r) => r.data as Call).map((c) =>
    `- ${c.date ?? ""} ${c.context || c.call || "conversation"}${c.elevated ? `; most airtime: ${c.elevated.slice(0, 160)}` : ""}${c.askedNext ? `; they asked next: ${c.askedNext.slice(0, 160)}` : ""}`
  );

  const lines = [
    "You decode jargon a working professional hears in business conversations: meetings, calls, negotiations, pitches, deals.",
    "The reader knows the basics of business but not every industry's vocabulary.",
    `Context of this conversation: ${ctx}. Use the meaning that fits this context when a term has several.`,
    "The reader keeps a personal word bank. Use it: when a new term relates to one they already have, connect them in plain (for example, 'Like X, but ...'), and match the reader's level.",
    "Plain words, short sentences, no em dashes.",
    "Fields: term (the usual name), aliases (other names or the expansion of an acronym), plain (what it means, at most two short sentences),",
    "why (why someone in this conversation cares, one sentence, concrete to the context), decision (the decision, negotiation point or action it affects, a short phrase),",
    `tag (one of ${TAGS.join(", ")}), confidence (high, medium or low; low when you are unsure what it means here, and then say in plain what to ask).`,
    "",
    "Word bank ({known} means the reader has mastered it):",
    bankLines.length ? bankLines.join("\n") : "(empty)",
  ];
  if (recent.length) lines.push("", "Recent conversations:", recent.join("\n"));
  if (mode === "scan") {
    lines.push("",
      "From the notes below, pick up to 8 terms of art (acronyms, program names, finance, legal or industry jargon) the reader may not know.",
      "Never return a term that is already in the word bank under any name.",
      'Return only JSON: {"terms":[{"term":"","aliases":[],"plain":"","why":"","decision":"","tag":"","confidence":""}]}. Return {"terms":[]} if nothing qualifies.',
      "", "Notes:", input);
  } else {
    lines.push("",
      "Decode the single main term in the text below.",
      'Return only JSON: {"term":"","aliases":[],"plain":"","why":"","decision":"","tag":"","confidence":""}.',
      "", `Text: ${input}`);
    if (notes) lines.push(`Context from today's notes: ${notes}`);
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-5-5",
      max_tokens: mode === "scan" ? 2500 : 800,
      messages: [{ role: "user", content: lines.join("\n") }],
    }),
  });
  if (!r.ok) {
    const status = r.status === 429 ? 429 : 502;
    return json({ error: status === 429 ? "Too many requests right now. Try again in a minute." : "The AI service didn't answer. Try again." }, status);
  }
  const out = await r.json();
  const text: string = (out.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return json({ error: "The answer came back in the wrong shape. Try again." }, 502);
  try { return json(JSON.parse(text.slice(a, b + 1))); }
  catch { return json({ error: "The answer came back in the wrong shape. Try again." }, 502); }
});
