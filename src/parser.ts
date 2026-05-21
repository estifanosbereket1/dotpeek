import { Command, CommandType } from "./types";

const DANGER_KEYWORDS: string[] = [
  "drop",
  "truncate",
  "rm -rf",
  "rm -fr",
  "wipe",
  "nuke",
  "destroy",
  "purge",
  "delete from",
  "drop table",
  "drop database",
  "format",
  "mkfs",
  ":(){:|:&};:",
];

function isDangerous(raw: string): boolean {
  const lower = raw.toLowerCase();
  return DANGER_KEYWORDS.some((k) => lower.includes(k));
}

function extractInlineComment(line: string): string {
  const match = line.match(/#\s*(.+)$/);
  return match ? match[1].trim() : "";
}

function makeCommand(
  type: CommandType,
  name: string,
  raw: string,
  desc: string,
  sourceLine: number,
  sourceFile: string,
): Command {
  return {
    type,
    name,
    raw,
    desc,
    danger: isDangerous(raw),
    sourceLine,
    sourceFile,
  };
}

export function parseDotfile(content: string, filePath: string): Command[] {
  const lines = content.split("\n");
  const commands: Command[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      i++;
      continue;
    }

    const aliasMatch = line.match(/^alias\s+([a-zA-Z0-9_.\-]+)=(.+)/);
    if (aliasMatch) {
      const name = aliasMatch[1];
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      const desc =
        extractInlineComment(rawLine) ||
        (prevLine.startsWith("#") ? prevLine.replace(/^#+\s*/, "") : "");
      commands.push(makeCommand("alias", name, line, desc, i + 1, filePath));
      i++;
      continue;
    }

    const exportMatch = line.match(/^export\s+([A-Z_][A-Z0-9_]*)=(.+)/);
    if (exportMatch) {
      const name = exportMatch[1];
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      const desc =
        extractInlineComment(rawLine) ||
        (prevLine.startsWith("#") ? prevLine.replace(/^#+\s*/, "") : "");
      commands.push(makeCommand("export", name, line, desc, i + 1, filePath));
      i++;
      continue;
    }

    const funcMatch = line.match(
      /^(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_\-]*)(\s*\(\s*\))?\s*\{?\s*$/,
    );
    if (funcMatch && (line.startsWith("function ") || line.includes("()"))) {
      const name = funcMatch[1];
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      const desc =
        extractInlineComment(rawLine) ||
        (prevLine.startsWith("#") ? prevLine.replace(/^#+\s*/, "") : "");

      const bodyLines: string[] = [rawLine];
      let depth =
        (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      i++;

      if (!(depth === 0 && line.includes("{") && line.includes("}"))) {
        while (i < lines.length) {
          const bl = lines[i];
          bodyLines.push(bl);
          depth += (bl.match(/\{/g) ?? []).length;
          depth -= (bl.match(/\}/g) ?? []).length;
          i++;
          if (depth <= 0) break;
        }
      }

      const rawFull = bodyLines.join("\n");
      commands.push(makeCommand("func", name, rawFull, desc, i + 1, filePath));
      continue;
    }

    i++;
  }

  return commands;
}
