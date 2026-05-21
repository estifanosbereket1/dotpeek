import { CommandType } from "./types";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const FG = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const BG = {
  blue: "\x1b[44m",
};

type ColorFn = (s: string) => string;

export const c: Record<string, ColorFn> = {
  bold: (s) => `${BOLD}${s}${RESET}`,
  dim: (s) => `${DIM}${s}${RESET}`,
  red: (s) => `${FG.red}${s}${RESET}`,
  green: (s) => `${FG.green}${s}${RESET}`,
  yellow: (s) => `${FG.yellow}${s}${RESET}`,
  cyan: (s) => `${FG.cyan}${s}${RESET}`,
  gray: (s) => `${FG.gray}${s}${RESET}`,
  boldCyan: (s) => `${BOLD}${FG.cyan}${s}${RESET}`,
  boldGreen: (s) => `${BOLD}${FG.green}${s}${RESET}`,
  boldYellow: (s) => `${BOLD}${FG.yellow}${s}${RESET}`,
  boldRed: (s) => `${BOLD}${FG.red}${s}${RESET}`,
  bgBlue: (s) => `${BG.blue}${FG.white}${s}${RESET}`,
};

export function typeTag(type: CommandType | string): string {
  switch (type) {
    case "alias":
      return c.bgBlue(" alias ");
    case "func":
      return `\x1b[42m\x1b[30m func \x1b[0m`;
    case "export":
      return `\x1b[43m\x1b[30m export \x1b[0m`;
    default:
      return `\x1b[47m\x1b[30m ${type} \x1b[0m`;
  }
}

export function dangerBadge(): string {
  return `\x1b[41m\x1b[37m ⚠ danger \x1b[0m`;
}

export function highlight(str: string, query: string): string {
  if (!query) return str;
  const idx = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return str;
  return (
    str.slice(0, idx) +
    `${BOLD}${FG.yellow}` +
    str.slice(idx, idx + query.length) +
    RESET +
    str.slice(idx + query.length)
  );
}

export function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function padEnd(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - visibleLength(str)));
}
