export const ROLES = [
  "Customer Support",
  "Sales",
  "HR / Recruitment",
  "Operations",
  "Others",
] as const;

export const PLACEHOLDER_BY_ROLE: Record<string, string> = {
  "Customer Support": "e.g. Responding to customer escalation emails",
  "Sales": "e.g. Writing follow-up emails to prospects",
  "HR / Recruitment": "e.g. Screening CVs against a job description",
  "Operations": "e.g. Generating monthly MIS reports",
  "Others": "e.g. Drafting weekly reports",
};

export const CATEGORIES = [
  { id: "repeated", label: "Most Repeated" },
  { id: "brain", label: "Most Brain-Heavy" },
  { id: "time", label: "Most Time-Consuming" },
] as const;

export const AI_CAPS = [
  { id: "read", label: "Reading text" },
  { id: "understand", label: "Understanding text" },
  { id: "generate", label: "Generating text" },
  { id: "classify", label: "Classifying/Tagging" },
  { id: "extract", label: "Extracting info" },
  { id: "image", label: "Generating images" },
  { id: "talk", label: "Talking/Voice" },
] as const;

export const SAMPLE_ACTIVITIES: Record<string, string[]> = {
  "Customer Support/Excellence": [
    "Drafting replies to customer complaints",
    "Summarising long customer email threads",
    "Tagging tickets by urgency and topic",
    "Writing weekly performance reports",
    "Looking up policy answers in SOPs",
  ],
  "Sales": [
    "Writing cold outreach emails",
    "Updating CRM after calls",
    "Researching prospect companies",
    "Building proposal decks",
    "Summarising call notes",
  ],
  "Marketing": [
    "Writing social media copy",
    "Generating campaign visuals",
    "Researching competitor positioning",
    "Editing blog drafts",
    "Building campaign brief decks",
  ],
  "HR": [
    "Screening CVs against JD",
    "Writing job descriptions",
    "Drafting policy emails to staff",
    "Summarising employee feedback surveys",
    "Building HR dashboards",
  ],
  "Recruitment": [
    "Sourcing candidates from LinkedIn",
    "Screening CVs",
    "Drafting outreach messages",
    "Scheduling interviews",
    "Writing interview feedback summaries",
  ],
  "Legal": [
    "Reviewing contracts for red flags",
    "Drafting NDAs and standard clauses",
    "Summarising case law",
    "Comparing two contract versions",
    "Researching regulations",
  ],
  "Finance": [
    "Building monthly MIS reports",
    "Reconciling invoices",
    "Variance analysis",
    "Drafting board commentary",
    "Cleaning Excel data",
  ],
  "IT/Software Development": [
    "Writing unit tests",
    "Documenting code and APIs",
    "Code reviews",
    "Writing release notes",
    "Debugging error logs",
  ],
  "Operations": [
    "Daily ops reports",
    "Inventory analysis",
    "Vendor follow-up emails",
    "Process documentation",
    "Root cause analysis",
  ],
  "Product Management": [
    "Writing PRDs",
    "Synthesising customer interviews",
    "Competitive analysis",
    "Building roadmap slides",
    "Drafting release announcements",
  ],
  "Underwriting": [
    "Reviewing loan applications",
    "Risk assessment write-ups",
    "Verifying customer documents",
    "Drafting decline emails",
    "Building underwriting summaries",
  ],
  "Other": [],
};

export function hoursSaved(weekly: number, aiCapable: string): number {
  const w = Number(weekly) || 0;
  if (aiCapable === "yes") return +(w * 0.7).toFixed(2);
  if (aiCapable === "partly") return +(w * 0.35).toFixed(2);
  return 0;
}

export function fallbackTool(caps: string[]): { tool: string; how_to: string } {
  const has = (c: string) => caps.includes(c);
  if (has("image")) return { tool: "Gemini (Nano Banana)", how_to: "Use Gemini's image generation to produce campaign visuals from a short text prompt. Iterate by editing the prompt or uploading reference imagery." };
  if (has("talk")) return { tool: "VAPI", how_to: "Build a voice agent in VAPI that handles your repeated voice interactions. Connect it to your phone number and define the conversation flow with prompts." };
  if (has("read") && has("understand")) return { tool: "NotebookLM", how_to: "Upload your long documents to NotebookLM and ask questions across them. It will cite passages, summarise sections and let you query the whole set." };
  if (has("classify") || has("extract")) return { tool: "Claude Skill", how_to: "Create a Claude Skill that classifies or extracts the structured fields you need. Paste in a batch of inputs and it returns clean, tagged output every time." };
  if (has("generate")) return { tool: "Claude Project + Skill", how_to: "Spin up a Claude Project with your reference docs, tone-of-voice and examples. Add a Skill for the repeated task so each draft starts from your context." };
  return { tool: "Claude Chat", how_to: "Start in Claude with a clear prompt describing the task and the output you want. Refine across a couple of turns and save the prompt for reuse." };
}
