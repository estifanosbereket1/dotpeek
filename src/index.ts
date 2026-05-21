#!/usr/bin/env node

import { discoverDotfiles, readDotfile } from "./discover";
import { parseDotfile } from "./parser";
import { search } from "./search";
import { runInteractiveUI } from "./ui";
import { c, typeTag, dangerBadge } from "./highlight";
import { runInit, printSnippet } from "./shell";
import { Command } from "./types";

const VERSION = "1.2.0";

const HELP = `
${c.boldCyan("dotpeek")} ${c.dim(`v${VERSION}`)} — browse & search your shell commands

${c.bold("Usage:")}
  dotpeek                          interactive browser
  dotpeek search <query>           search all commands
  dotpeek list                     list all commands
  dotpeek list --type alias        filter by type (alias|func|export)
  dotpeek list --danger            show only dangerous commands
  dotpeek files                    show discovered dotfiles
  dotpeek init                     set up shell integration (peek + ctrl+p)
  dotpeek init --shell bash|zsh    specify shell explicitly
  dotpeek --shell-snippet          print raw shell snippet (for manual install)
  dotpeek --shell-snippet --shell zsh
  dotpeek --help                   show this help

${c.bold("Interactive mode keys:")}
  ↑↓           navigate
  enter        expand command
  a            explain with AI
  c            copy raw command
  type         search / filter
  tab          cycle type filter
  esc          clear search
  q            quit

${c.bold("Shell integration (after dotpeek init):")}
  peek                             open dotpeek
  peek search <query>              search from the command line
  ctrl+p                           open dotpeek inline at any prompt
`;

function loadAll(): {
  files: ReturnType<typeof discoverDotfiles>;
  allCommands: Command[];
} {
  const files = discoverDotfiles();
  const allCommands: Command[] = [];
  for (const file of files) {
    const content = readDotfile(file.path);
    if (!content) continue;
    allCommands.push(...(parseDotfile(content, file.path) as Command[]));
  }
  return { files, allCommands };
}

function printCommand(cmd: Command): void {
  const src = cmd.sourceFile.replace(process.env.HOME ?? "", "~");
  const tag = typeTag(cmd.type);
  const danger = cmd.danger ? " " + dangerBadge() : "";
  const desc = cmd.desc ? c.dim("  " + cmd.desc) : "";
  console.log(`${tag}${danger} ${c.boldCyan(cmd.name)}${desc}`);
  console.log(`         ${c.gray(src + ":" + cmd.sourceLine)}`);
  console.log(`         ${c.cyan(cmd.raw.split("\n")[0].slice(0, 100))}`);
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    process.exit(0);
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    process.exit(0);
  }

  // print raw snippet for manual install (e.g. pipe into a file or inspect)
  if (cmd === "--shell-snippet") {
    printSnippet(args.slice(1));
    process.exit(0);
  }

  // guided shell integration setup
  if (cmd === "init") {
    await runInit(args.slice(1));
    process.exit(0);
  }

  if (cmd === "files") {
    const { files } = loadAll();
    console.log("");
    console.log(`  ${c.boldCyan("discovered dotfiles:")}`);
    console.log("");
    if (files.length === 0) {
      console.log(`  ${c.dim("none found")}`);
    } else {
      for (const f of files) console.log(`  ${c.green("✓")}  ${f.label}`);
    }
    console.log("");
    process.exit(0);
  }

  if (cmd === "search") {
    const query = args.slice(1).join(" ");
    if (!query) {
      console.error(c.red("Error: provide a search query."));
      process.exit(1);
    }
    const { allCommands } = loadAll();
    const results = search(allCommands, query);
    console.log("");
    console.log(
      `  ${c.boldCyan("dotpeek")}  ${c.dim(`${results.length} result(s) for`)} ${c.yellow('"' + query + '"')}`,
    );
    console.log("");
    if (results.length === 0) {
      console.log(`  ${c.dim("no matches found")}`);
    } else {
      for (const r of results) printCommand(r);
    }
    process.exit(0);
  }

  if (cmd === "list") {
    const typeArg = args.includes("--type")
      ? args[args.indexOf("--type") + 1]
      : undefined;
    const dangerOnly = args.includes("--danger");
    const { allCommands } = loadAll();
    const results = search(allCommands, "", {
      type: (typeArg as Command["type"] | "all") ?? "all",
      dangerOnly,
    });
    console.log("");
    console.log(
      `  ${c.boldCyan("dotpeek")}  ${c.dim(results.length + " " + (typeArg ? c.yellow(typeArg + "s") : "all commands"))}`,
    );
    console.log("");
    if (results.length === 0) {
      console.log(`  ${c.dim("nothing found")}`);
    } else {
      for (const r of results) printCommand(r);
    }
    process.exit(0);
  }

  const { allCommands, files } = loadAll();
  if (allCommands.length === 0) {
    console.log("");
    console.log(`  ${c.yellow("⚠")}  No commands found in any dotfile.`);
    console.log(
      `     Looked in: ${files.map((f) => f.label).join(", ") || "none found"}`,
    );
    console.log(
      `     Run ${c.cyan("dotpeek files")} to see what was detected.`,
    );
    console.log("");
    process.exit(0);
  }

  await runInteractiveUI(allCommands, { search });
}

main().catch((err) => {
  console.error(c.red("Error: ") + (err as Error).message);
  process.exit(1);
});
