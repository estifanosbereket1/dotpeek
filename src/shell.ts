import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { c } from "./highlight";

export type SupportedShell = "bash" | "zsh";

export function detectShell(): SupportedShell | "unknown" {
  const shell = process.env.SHELL ?? "";
  if (shell.endsWith("zsh")) return "zsh";
  if (shell.endsWith("bash")) return "bash";
  return "unknown";
}

export function getRcFile(shell: SupportedShell): string {
  const home = os.homedir();
  return shell === "zsh"
    ? path.join(home, ".zshrc")
    : path.join(home, ".bashrc");
}

export function isAlreadyInstalled(rcPath: string): boolean {
  try {
    return fs
      .readFileSync(rcPath, "utf-8")
      .includes("# dotpeek shell integration");
  } catch {
    return false;
  }
}

export function getShellSnippet(shell: SupportedShell): string {
  if (shell === "zsh") {
    return [
      "",
      "# dotpeek shell integration",
      'peek() { dotpeek "$@"; }',
      "_dotpeek_widget() { dotpeek; zle reset-prompt; }",
      "zle -N _dotpeek_widget",
      "bindkey '^p' _dotpeek_widget",
      "",
    ].join("\n");
  } else {
    // bash: bind -x works in interactive shells; guard with || true so
    // non-interactive sourcing (e.g. scripts) doesn't blow up
    return [
      "",
      "# dotpeek shell integration",
      'peek() { dotpeek "$@"; }',
      "bind -x '\"\\C-p\": dotpeek' 2>/dev/null || true",
      "",
    ].join("\n");
  }
}

export async function runInit(args: string[]): Promise<void> {
  const shellFlagIdx = args.indexOf("--shell");
  const explicitShell = shellFlagIdx !== -1 ? args[shellFlagIdx + 1] : null;
  const targetShell: SupportedShell | "unknown" = explicitShell
    ? (explicitShell as SupportedShell)
    : detectShell();

  console.log("");
  console.log(`  ${c.boldCyan("dotpeek init")}  — shell integration setup`);
  console.log("");

  if (targetShell === "unknown") {
    console.log(
      `  ${c.yellow("⚠")}  Could not detect shell from $SHELL` +
        (process.env.SHELL ? ` ("${process.env.SHELL}")` : " (unset)") +
        ".",
    );
    console.log(
      `     Specify manually:  ${c.cyan("dotpeek init --shell bash")}  or  ${c.cyan("dotpeek init --shell zsh")}`,
    );
    console.log("");
    process.exit(1);
  }

  if (targetShell !== "bash" && targetShell !== "zsh") {
    console.log(
      `  ${c.red("Error:")} unsupported shell "${targetShell}". Supported: ${c.cyan("bash")}, ${c.cyan("zsh")}.`,
    );
    console.log("");
    process.exit(1);
  }

  const rcFile = getRcFile(targetShell);
  const rcLabel = rcFile.replace(os.homedir(), "~");

  console.log(`  ${c.gray("shell")}    ${c.green(targetShell)}`);
  console.log(`  ${c.gray("rc file")}  ${c.cyan(rcLabel)}`);
  console.log("");

  // already installed?
  if (isAlreadyInstalled(rcFile)) {
    console.log(`  ${c.green("✓")}  Already installed in ${c.cyan(rcLabel)}`);
    console.log(
      `     To remove, delete the ${c.dim("# dotpeek shell integration")} block from that file.`,
    );
    console.log("");
    process.exit(0);
  }

  // rc file missing (unlikely but possible for zsh on a fresh system)
  if (!fs.existsSync(rcFile)) {
    console.log(
      `  ${c.yellow("⚠")}  ${rcLabel} doesn't exist yet — it will be created.`,
    );
    console.log("");
  }

  const snippet = getShellSnippet(targetShell);

  console.log(`  ${c.bold("Will append to")} ${c.cyan(rcLabel)}:`);
  console.log("");
  for (const line of snippet.trim().split("\n")) {
    console.log(`    ${c.dim(line)}`);
  }
  console.log("");
  console.log(`  ${c.bold("What you get:")}`);
  console.log(
    `    ${c.green("peek")}               open dotpeek (alias for ${c.cyan("dotpeek")})`,
  );
  console.log(
    `    ${c.green("peek search git")}    search from the command line`,
  );
  console.log(
    `    ${c.green("ctrl+p")}             open dotpeek inline at any prompt`,
  );
  console.log("");

  const confirmed = await confirmPrompt("  Proceed? [y/N] ");

  if (!confirmed) {
    console.log(`\n  ${c.dim("Aborted. Nothing was changed.")}\n`);
    process.exit(0);
  }

  try {
    fs.appendFileSync(rcFile, snippet, "utf-8");
  } catch (err) {
    console.log(
      `\n  ${c.red("Error:")} could not write to ${rcLabel}: ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  console.log("");
  console.log(`  ${c.green("✓")}  Done! Reload your shell to activate:`);
  console.log("");
  console.log(`    ${c.cyan(`source ${rcLabel}`)}`);
  console.log("");
  console.log(`  Then try:`);
  console.log(`    ${c.cyan("peek")}                open dotpeek`);
  console.log(`    ${c.cyan("peek search git")}     search for git aliases`);
  console.log(
    `    ${c.cyan("ctrl+p")}              open dotpeek at any prompt`,
  );
  console.log("");
  console.log(
    `  ${c.dim("To uninstall later, remove the # dotpeek shell integration block from " + rcLabel)}`,
  );
  console.log("");
}

export function printSnippet(args: string[]): void {
  const shellFlagIdx = args.indexOf("--shell");
  let targetShell: SupportedShell | "unknown" =
    shellFlagIdx !== -1
      ? (args[shellFlagIdx + 1] as SupportedShell)
      : detectShell();

  // fall back to bash if shell is undetectable
  if (targetShell === "unknown") targetShell = "bash";

  process.stdout.write(
    getShellSnippet(targetShell as SupportedShell).trim() + "\n",
  );
}

function confirmPrompt(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}
