import fs from "fs";
import path from "path";
import os from "os";
import { DotFile } from "./types";

const HOME = os.homedir();

const KNOWN_FILES: string[] = [
  ".bashrc",
  ".bash_profile",
  ".bash_aliases",
  ".zshrc",
  ".zprofile",
  ".zshenv",
  ".aliases",
  ".aliases.sh",
  ".shell_aliases",
  ".functions",
  ".exports",
  ".profile",
  ".config/fish/config.fish",
  ".config/fish/functions",
];

const SCAN_DIRS: string[] = [
  ".config/shell",
  ".shell",
  ".dotfiles",
  "dotfiles",
];

function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function dirExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function scanDir(dirPath: string): string[] {
  const found: string[] = [];
  try {
    for (const entry of fs.readdirSync(dirPath)) {
      const full = path.join(dirPath, entry);
      if (fileExists(full) && /\.(sh|bash|zsh|fish)$/.test(entry)) {
        found.push(full);
      }
    }
  } catch {}
  return found;
}

export function discoverDotfiles(): DotFile[] {
  const found: DotFile[] = [];
  const seen = new Set<string>();

  function add(p: string): void {
    const resolved = path.resolve(p);
    if (!seen.has(resolved) && fileExists(resolved)) {
      seen.add(resolved);
      found.push({ path: resolved, label: p.replace(HOME, "~") });
    }
  }

  for (const f of KNOWN_FILES) add(path.join(HOME, f));

  for (const dir of SCAN_DIRS) {
    const dirPath = path.join(HOME, dir);
    if (dirExists(dirPath)) {
      for (const f of scanDir(dirPath)) add(f);
    }
  }

  return found;
}

export function readDotfile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}
