import fs from "fs";
import os from "os";
import path from "path";

const KEYS_DIR = path.join(os.homedir(), ".config", "dotpeek");
const KEYS_PATH = path.join(KEYS_DIR, "keys");

export interface ProviderDef {
  envKey: string;
  label: string;
  note: string;
  providerId: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    envKey: "GROQ_API_KEY",
    label: "Groq",
    note: "free · 14,400 req/day — recommended",
    providerId: "groq",
  },
  {
    envKey: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    note: "Claude API",
    providerId: "anthropic-api",
  },
  {
    envKey: "GEMINI_API_KEY",
    label: "Google Gemini",
    note: "Gemini API",
    providerId: "gemini-api",
  },
  {
    envKey: "OPENAI_API_KEY",
    label: "OpenAI",
    note: "GPT models",
    providerId: "openai-api",
  },
];

function loadStoredKeys(): Record<string, string> {
  try {
    const content = fs.readFileSync(KEYS_PATH, "utf8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (k && v) result[k] = v;
    }
    return result;
  } catch {
    return {};
  }
}

function writeKeys(keys: Record<string, string>): void {
  try {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    const lines = [
      "# dotpeek AI keys",
      "# managed by dotpeek — do not commit this file",
      "",
      ...Object.entries(keys).map(([k, v]) => `${k}=${v}`),
    ];
    fs.writeFileSync(KEYS_PATH, lines.join("\n") + "\n", "utf8");
  } catch {}
}

export function applyStoredKeys(): void {
  const stored = loadStoredKeys();
  for (const [k, v] of Object.entries(stored)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

export function saveKey(envKey: string, value: string): void {
  const stored = loadStoredKeys();
  stored[envKey] = value;
  writeKeys(stored);
  process.env[envKey] = value;
}

export function deleteKey(envKey: string): void {
  const stored = loadStoredKeys();
  delete stored[envKey];
  writeKeys(stored);
  delete process.env[envKey];
}

export function maskKey(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}
