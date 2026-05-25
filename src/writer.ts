import fs from "fs";
import { Command, CommandType } from "./types";

export interface NewCommand {
  type: CommandType;
  name: string;
  value: string;
  desc: string;
}

export function formatCommand(cmd: NewCommand): string {
  const lines: string[] = [];

  if (cmd.desc) lines.push(`# ${cmd.desc}`);

  if (cmd.type === "alias") {
    // single-quote the value; escape any existing single quotes
    const val = cmd.value.replace(/'/g, "'\\''");
    lines.push(`alias ${cmd.name}='${val}'`);
  } else if (cmd.type === "export") {
    lines.push(`export ${cmd.name}=${cmd.value}`);
  } else {
    // func — wrap body in braces
    lines.push(`${cmd.name}() {`);
    for (const bodyLine of cmd.value.split("\n")) {
      lines.push(`  ${bodyLine.trim()}`);
    }
    lines.push("}");
  }

  return lines.join("\n");
}

export function appendCommand(cmd: NewCommand, filePath: string): void {
  const block = "\n" + formatCommand(cmd) + "\n";
  fs.appendFileSync(filePath, block, "utf8");
}

export function replaceCommand(
  oldCmd: Command,
  newCmd: NewCommand,
  filePath: string,
): void {
  let content = fs.readFileSync(filePath, "utf8");

  // build the "old block" — comment (if any) + raw
  let oldBlock = oldCmd.raw;
  if (oldCmd.desc) {
    const withComment = `# ${oldCmd.desc}\n${oldCmd.raw}`;
    if (content.includes(withComment)) oldBlock = withComment;
  }

  const idx = content.indexOf(oldBlock);
  if (idx === -1) {
    // can't locate it — safe fallback: append as new
    appendCommand(newCmd, filePath);
    return;
  }

  const newBlock = formatCommand(newCmd);
  content =
    content.slice(0, idx) + newBlock + content.slice(idx + oldBlock.length);

  fs.writeFileSync(filePath, content, "utf8");
}

export function extractValue(cmd: Command): string {
  if (cmd.type === "alias") {
    const m = cmd.raw.match(/^alias\s+[^=]+=(.+)$/);
    if (m) return m[1].replace(/^['"]|['"]$/g, "");
  }
  if (cmd.type === "export") {
    const m = cmd.raw.match(/^export\s+[A-Z_0-9]+=(.+)$/);
    if (m) return m[1];
  }
  if (cmd.type === "func") {
    const bodyLines = cmd.raw
      .split("\n")
      .slice(1, -1) // drop first (signature) and last (closing })
      .map((l) => l.trim())
      .filter(Boolean);
    return bodyLines.join("; ");
  }
  return "";
}
