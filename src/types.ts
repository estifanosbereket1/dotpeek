export type CommandType = "alias" | "func" | "export";

export interface DotFile {
  path: string;
  label: string;
}

export interface Command {
  type: CommandType;
  name: string;
  raw: string;
  desc: string;
  danger: boolean;
  sourceLine: number;
  sourceFile: string;
}

export interface ScoredCommand extends Command {
  _score: number;
}

export interface SearchOptions {
  type?: CommandType | "all";
  dangerOnly?: boolean;
}

export type AIProvider =
  | "groq"
  | "claude"
  | "gemini"
  | "gemini-api"
  | "anthropic-api"
  | "openai-api"
  | string;

export interface AIResult {
  desc: string;
  provider: AIProvider;
  cached: boolean;
}

export type AIStatus =
  | { status: "loading" }
  | { status: "done"; desc: string; provider: AIProvider; cached: boolean }
  | { status: "error"; msg: string };
