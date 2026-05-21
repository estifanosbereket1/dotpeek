import { Command, ScoredCommand, SearchOptions } from "./types";

function fuzzyMatch(str: string, pattern: string): boolean {
  let si = 0;
  let pi = 0;
  while (si < str.length && pi < pattern.length) {
    if (str[si] === pattern[pi]) pi++;
    si++;
  }
  return pi === pattern.length;
}

function scoreCommand(cmd: Command, query: string): number {
  const q = query.toLowerCase();
  const name = cmd.name.toLowerCase();
  const desc = (cmd.desc ?? "").toLowerCase();
  const raw = (cmd.raw ?? "").toLowerCase();

  let score = 0;

  if (name === q) return 1000;
  if (name.startsWith(q)) score += 100;
  if (name.includes(q)) score += 50;
  if (desc.includes(q)) score += 30;
  if (raw.includes(q)) score += 10;
  if (score === 0 && fuzzyMatch(name, q)) score += 5;

  return score;
}

export function search(
  allCommands: Command[],
  query: string,
  opts: SearchOptions = {},
): ScoredCommand[] {
  let results = [...allCommands];

  if (opts.type && opts.type !== "all") {
    results = results.filter((c) => c.type === opts.type);
  }

  if (opts.dangerOnly) {
    results = results.filter((c) => c.danger);
  }

  if (!query || !query.trim()) {
    return results.map((c) => ({ ...c, _score: 1 }));
  }

  return results
    .map((c) => ({ ...c, _score: scoreCommand(c, query.trim()) }))
    .filter((c) => c._score > 0)
    .sort((a, b) => b._score - a._score);
}
