import readline from "readline";
import { execSync } from "child_process";
import { c, typeTag, dangerBadge, highlight } from "./highlight";
import { explainCommand } from "./ai";
import {
  Command,
  ScoredCommand,
  AIStatus,
  SearchOptions,
  CommandType,
} from "./types";

const ROWS = process.stdout.rows ?? 30;
const LIST_HEIGHT = Math.min(20, ROWS - 10);

const aiDescCache: Record<string, AIStatus & { status: "done" }> = {};

type SearchFn = (
  cmds: Command[],
  query: string,
  opts?: SearchOptions,
) => ScoredCommand[];

const LOGO = [
  "██████╗  ██████╗ ████████╗██████╗ ███████╗███████╗██╗  ██╗",
  "██╔══██╗██╔═══██╗╚══██╔══╝██╔══██╗██╔════╝██╔════╝██║ ██╔╝",
  "██║  ██║██║   ██║   ██║   ██████╔╝█████╗  █████╗  █████╔╝ ",
  "██║  ██║██║   ██║   ██║   ██╔═══╝ ██╔══╝  ██╔══╝  ██╔═██╗ ",
  "██████╔╝╚██████╔╝   ██║   ██║     ███████╗███████╗██║  ██╗ ",
  "╚═════╝  ╚═════╝    ╚═╝   ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝",
];

function cleanExit(code = 0): never {
  try {
    process.stdout.write("\x1b[2J\x1b[H");
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  } catch {}
  process.exit(code);
}

function execCopy(text: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    execSync("pbcopy", { input: text });
  } else if (platform === "win32") {
    execSync("clip", { input: text });
  } else {
    try {
      execSync("xclip -selection clipboard", { input: text });
      return;
    } catch {}
    try {
      execSync("xsel --clipboard --input", { input: text });
      return;
    } catch {}
    try {
      execSync("wl-copy", { input: text });
      return;
    } catch {}
  }
}

function formatSourceFile(filePath: string): string {
  return filePath.replace(process.env.HOME ?? "", "~");
}

function renderSplash(commandCount: number): string {
  const width = process.stdout.columns ?? 100;
  const height = process.stdout.rows ?? 30;

  const LOGO_WIDTH = 60;
  const leftPad = Math.max(2, Math.floor((width - LOGO_WIDTH) / 2));
  const pad = " ".repeat(leftPad);

  const CONTENT_HEIGHT = 16;
  const topPad = Math.max(1, Math.floor((height - CONTENT_HEIGHT) / 2));

  const lines: string[] = [];

  for (let i = 0; i < topPad; i++) lines.push("");

  for (const row of LOGO) {
    lines.push(pad + c.boldCyan(row));
  }

  lines.push("");
  lines.push(pad + c.dim("  browse & search your shell commands"));
  lines.push("");

  const features = [
    [
      "auto-discovers",
      `all your dotfiles  ${c.dim(`(${commandCount} commands loaded)`)}`,
    ],
    ["AI explanations", "for any command, press  " + c.cyan("a")],
    ["live fuzzy search", "across everything as you type"],
    ["danger detection", "⚠  flags risky commands automatically"],
  ];

  for (const [bold, rest] of features) {
    lines.push(pad + `  ${c.cyan("◆")}  ${c.bold(bold)}  ${c.dim(rest)}`);
  }

  lines.push("");
  lines.push(pad + c.dim("  ── press any key to start ──"));
  lines.push("");

  return lines.join("\n");
}

function renderCommandDetail(cmd: Command, aiState: AIStatus | null): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(
    `  ${typeTag(cmd.type)}${cmd.danger ? " " + dangerBadge() : ""}  ${c.boldCyan(cmd.name)}`,
  );
  lines.push("");

  if (cmd.desc) lines.push(`  ${c.gray("desc")}   ${cmd.desc}`);

  if (aiState) {
    if (aiState.status === "loading") {
      lines.push(`  ${c.gray("ai  ")}   ${c.dim("thinking...")}`);
    } else if (aiState.status === "done") {
      const tag = c.dim(
        `[${aiState.provider}${aiState.cached ? " · cached" : ""}]`,
      );
      lines.push(`  ${c.gray("ai  ")}   ${c.green(aiState.desc)}  ${tag}`);
    } else if (aiState.status === "error") {
      lines.push(`  ${c.gray("ai  ")}   ${c.red(aiState.msg)}`);
    }
  }

  lines.push(
    `  ${c.gray("file")}   ${c.dim(formatSourceFile(cmd.sourceFile))}:${cmd.sourceLine}`,
  );
  lines.push("");
  lines.push(`  ${c.gray("code")}`);
  for (const rl of cmd.raw.split("\n")) lines.push(`    ${c.cyan(rl)}`);
  lines.push("");

  const aiHint = !aiState ? `  ${c.dim("[ a ] explain with AI   ")}` : "";
  lines.push(`  ${c.dim("[ c ] copy   [ q / esc ] back")}${aiHint}`);
  lines.push("");
  return lines.join("\n");
}

function renderList(
  commands: ScoredCommand[],
  selected: number,
  query: string,
  filter: string,
  scrollOffset: number,
): string {
  const termWidth = process.stdout.columns ?? 100;
  const visible = commands.slice(scrollOffset, scrollOffset + LIST_HEIGHT);
  const lines: string[] = [];

  lines.push("");
  lines.push(
    `  ${c.boldCyan("dotpeek")}  ${c.dim(`${commands.length} commands`)}` +
      (filter !== "all" ? `  ${c.yellow("[" + filter + "]")}` : ""),
  );
  lines.push(`  ${c.dim("─".repeat(Math.min(termWidth - 4, 60)))}`);
  lines.push(`  ${c.gray("/")} ${query || c.dim("type to search...")}`);
  lines.push(`  ${c.dim("─".repeat(Math.min(termWidth - 4, 60)))}`);

  if (visible.length === 0) {
    lines.push("");
    lines.push(`  ${c.dim("no results")}`);
  }

  for (let i = 0; i < visible.length; i++) {
    const cmd = visible[i];
    const globalIdx = scrollOffset + i;
    const isSelected = globalIdx === selected;
    const tag = typeTag(cmd.type);
    const name = highlight(cmd.name, query);
    const desc = cmd.desc
      ? c.dim("  " + cmd.desc.slice(0, 45) + (cmd.desc.length > 45 ? "…" : ""))
      : "";
    const danger = cmd.danger ? " " + c.red("⚠") : "";
    const src = c.gray(
      ` [${formatSourceFile(cmd.sourceFile).split("/").pop()}]`,
    );
    const row = `  ${tag} ${c.bold(name)}${danger}${desc}${src}`;

    lines.push(isSelected ? `\x1b[7m${row}\x1b[0m` : row);
  }

  if (commands.length > LIST_HEIGHT) {
    const pct = Math.round(
      (scrollOffset / (commands.length - LIST_HEIGHT)) * 100,
    );
    lines.push(`  ${c.dim(`─── ${pct}% ───`)}`);
  }

  lines.push("");
  lines.push(
    `  ${c.dim("↑↓ navigate   enter expand   / search   tab filter   q quit")}`,
  );
  lines.push("");
  return lines.join("\n");
}

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

const FILTERS = ["all", "alias", "func", "export", "danger"] as const;

export async function runInteractiveUI(
  allCommands: Command[],
  { search }: { search: SearchFn },
): Promise<void> {
  if (!process.stdin.isTTY) {
    for (const cmd of allCommands) {
      console.log(
        `${cmd.type.padEnd(8)} ${cmd.name.padEnd(24)} ${cmd.desc ?? ""}`,
      );
    }
    return;
  }

  process.once("SIGTERM", () => cleanExit(0));
  process.once("SIGHUP", () => cleanExit(0));

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  let query = "";
  let filterIdx = 0;
  let selected = 0;
  let scrollOffset = 0;
  let mode: "splash" | "list" | "detail" = "splash";
  let currentAiState: AIStatus | null = null;

  function getFiltered(): ScoredCommand[] {
    const filter = FILTERS[filterIdx];
    return search(allCommands, query, {
      type: filter === "danger" ? "all" : (filter as CommandType | "all"),
      dangerOnly: filter === "danger",
    });
  }

  function clampSelected(cmds: ScoredCommand[]): void {
    if (selected >= cmds.length) selected = Math.max(0, cmds.length - 1);
    if (selected < scrollOffset) scrollOffset = selected;
    if (selected >= scrollOffset + LIST_HEIGHT)
      scrollOffset = selected - LIST_HEIGHT + 1;
  }

  function draw(): void {
    clearScreen();
    if (mode === "splash") {
      process.stdout.write(renderSplash(allCommands.length));
      return;
    }
    const cmds = getFiltered();
    clampSelected(cmds);
    if (mode === "detail" && cmds[selected]) {
      process.stdout.write(renderCommandDetail(cmds[selected], currentAiState));
    } else {
      process.stdout.write(
        renderList(cmds, selected, query, FILTERS[filterIdx], scrollOffset),
      );
    }
  }

  async function triggerAI(cmd: Command): Promise<void> {
    const key = `${cmd.type}:${cmd.name}`;
    if (aiDescCache[key]) {
      currentAiState = { ...aiDescCache[key] };
      draw();
      return;
    }
    currentAiState = { status: "loading" };
    draw();
    try {
      const result = await explainCommand(cmd);
      aiDescCache[key] = { status: "done", ...result };
      currentAiState = { status: "done", ...result };
    } catch (err) {
      currentAiState = { status: "error", msg: (err as Error).message };
    }
    draw();
  }

  draw();

  process.stdin.on("keypress", (str: string, key: readline.Key) => {
    if (mode === "splash") {
      if (key.ctrl && key.name === "c") cleanExit(0);
      mode = "list";
      draw();
      return;
    }

    if (mode === "detail") {
      if (key.name === "q" || key.name === "escape") {
        mode = "list";
        currentAiState = null;
        draw();
      } else if (str === "c") {
        const cmds = getFiltered();
        if (cmds[selected])
          try {
            execCopy(cmds[selected].raw);
          } catch {}
      } else if (str === "a") {
        const cmds = getFiltered();
        if (cmds[selected] && !currentAiState) triggerAI(cmds[selected]);
      }
      return;
    }

    const cmds = getFiltered();

    if (key.ctrl && key.name === "c") cleanExit(0);
    if (key.name === "q") cleanExit(0);

    if (key.name === "up") {
      selected = Math.max(0, selected - 1);
      if (selected < scrollOffset) scrollOffset = selected;
      draw();
    } else if (key.name === "down") {
      selected = Math.min(cmds.length - 1, selected + 1);
      if (selected >= scrollOffset + LIST_HEIGHT)
        scrollOffset = selected - LIST_HEIGHT + 1;
      draw();
    } else if (key.name === "tab") {
      filterIdx = (filterIdx + 1) % FILTERS.length;
      selected = 0;
      scrollOffset = 0;
      draw();
    } else if (key.name === "return") {
      if (cmds[selected]) {
        mode = "detail";
        currentAiState = null;
        draw();
      }
    } else if (key.name === "backspace") {
      query = query.slice(0, -1);
      selected = 0;
      scrollOffset = 0;
      draw();
    } else if (key.name === "escape") {
      query = "";
      selected = 0;
      scrollOffset = 0;
      draw();
    } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
      query += str;
      selected = 0;
      scrollOffset = 0;
      draw();
    }
  });

  await new Promise(() => {});
}
