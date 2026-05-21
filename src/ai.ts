import { execSync, execFileSync } from 'child_process';
import https, { RequestOptions } from 'https';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { Command, AIProvider, AIResult } from './types';

const CACHE_PATH = path.join(os.homedir(), '.dotpeek_ai_cache.json');

interface CacheEntry {
  desc: string;
  provider: AIProvider;
  ts: number;
}

interface Cache {
  [key: string]: CacheEntry;
}

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {}
}

function cacheKey(cmd: Command): string {
  return `${cmd.type}:${cmd.name}:${cmd.raw.slice(0, 120)}`;
}

function commandExists(name: string): boolean {
  try {
   execSync(`command -v ${name}`, { stdio: 'ignore', shell: '/bin/sh' });
    return true;
  } catch {
    return false;
  }
}

export function detectProvider(): AIProvider | null {
  const forced = process.env.DOTPEEK_AI;
  if (forced) return forced;

  if (process.env.GROQ_API_KEY) return 'groq';
  if (commandExists('claude')) return 'claude';
  if (process.env.GEMINI_API_KEY) return 'gemini-api';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic-api';
  if (process.env.OPENAI_API_KEY) return 'openai-api';
  if (commandExists('gemini')) return 'gemini';

  return null;
}

function buildPrompt(cmd: Command): string {
  return [
    `You are a shell command explainer. Be concise and direct.`,
    `Explain what this shell ${cmd.type} does in 1-2 sentences.`,
    `If it's dangerous (e.g. deletes data, drops databases, rm -rf), start with "⚠ DANGER:".`,
    `Reply with ONLY the description. No markdown, no preamble, no quotes.`,
    ``,
    `${cmd.raw}`,
  ].join('\n');
}

function askCLI(binary: string, prompt: string): string {
  if (binary === 'gemini') {
    return execFileSync(binary, ['-p', prompt], {
      input: '',
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env },
    }).trim();
  }
  if (binary === 'claude') {
    return execFileSync(binary, ['-p'], {
      input: prompt,
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env },
    }).trim();
  }
  return execFileSync(binary, ['-p', prompt], {
    input: '',
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env },
  }).trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function httpsPost(options: RequestOptions, body: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function askGroq(prompt: string): Promise<string> {
  const data = await httpsPost(
    {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
    },
    {
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    },
  );
  return data.choices?.[0]?.message?.content?.trim() ?? 'No response';
}

async function askAnthropicAPI(prompt: string): Promise<string> {
  const data = await httpsPost(
    {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    },
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    },
  );
  return data.content?.[0]?.text?.trim() ?? 'No response';
}

async function askGeminiAPI(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const data = await httpsPost(
    {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 150 } },
  );
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'No response';
}

async function askOpenAIAPI(prompt: string): Promise<string> {
  const data = await httpsPost(
    {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    },
    { model: 'gpt-4o-mini', max_tokens: 150, messages: [{ role: 'user', content: prompt }] },
  );
  return data.choices?.[0]?.message?.content?.trim() ?? 'No response';
}

export async function explainCommand(cmd: Command): Promise<AIResult> {
  const cache = loadCache();
  const key = cacheKey(cmd);

  if (cache[key]) {
    return { desc: cache[key].desc, provider: cache[key].provider, cached: true };
  }

  const provider = detectProvider();
  if (!provider) {
    throw new Error(
      'No AI provider found. Set GROQ_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.',
    );
  }

  const prompt = buildPrompt(cmd);
  let desc: string;

  switch (provider) {
    case 'claude':
    case 'gemini':
      desc = askCLI(provider, prompt);
      break;
    case 'groq':
      desc = await askGroq(prompt);
      break;
    case 'anthropic-api':
      desc = await askAnthropicAPI(prompt);
      break;
    case 'gemini-api':
      desc = await askGeminiAPI(prompt);
      break;
    case 'openai-api':
      desc = await askOpenAIAPI(prompt);
      break;
    default:
      desc = askCLI(provider, prompt);
  }

  cache[key] = { desc, provider, ts: Date.now() };
  saveCache(cache);

  return { desc, provider, cached: false };
}
