# dotpeek 🔍
> You store dozens of commands in your dotfiles. You forget half of them. dotpeek fixes that.

dotpeek auto-discovers your `.bashrc`, `.zshrc`, and shell config files and gives you a fast, searchable, AI-powered terminal UI to browse everything in one place.

---

## Install

```bash
npm install -g dotpeek
```

Or try it instantly:

```bash
npx dotpeek
```

---

## Demo

> *(gif here)*

---

## Features

- **Auto-discovery** — finds your dotfiles automatically, no config needed
- **Shell integration** — one command adds `peek` and `ctrl+p` to your shell permanently
- **AI explanations** — press `a` on any command to get an instant plain-English description
- **Danger detection** — flags commands with `rm -rf`, `DROP`, `nuke`, and other destructive keywords with ⚠
- **Live search** — fuzzy search across all commands from all files as you type
- **Zero dependencies** — pure Node.js, no `node_modules`

---

## Usage

```bash
dotpeek                        # open interactive browser
dotpeek search deploy          # search from the terminal
dotpeek list                   # list all commands
dotpeek list --type alias      # filter by type: alias | func | export
dotpeek list --danger          # show only dangerous commands
dotpeek files                  # show which dotfiles were discovered
dotpeek init                   # set up shell integration (peek + ctrl+p)
```

---

## Shell integration

Run once after installing:

```bash
dotpeek init
```

dotpeek detects your shell, shows you exactly what it will add, asks for confirmation, then appends a small snippet to your `.bashrc` or `.zshrc`. That's it.

```bash
source ~/.zshrc     # reload to activate (or open a new terminal)
```

**What you get:**

```bash
peek                  # open dotpeek from anywhere
peek search git       # search directly from the command line
# ctrl+p              # open dotpeek inline at any prompt
```

`ctrl+p` works like a widget — press it at an empty prompt, browse your commands, press `q`, and you're right back where you were with a clean terminal.

**Options:**

```bash
dotpeek init --shell bash          # specify shell explicitly
dotpeek init --shell zsh
dotpeek --shell-snippet            # print the raw snippet (for manual install)
dotpeek --shell-snippet --shell bash
```

---

## Interactive mode

Launch with `dotpeek` (or `peek`) and use your keyboard:

| Key | Action |
|-----|--------|
| `↑↓` | navigate |
| `enter` | expand command |
| `a` | explain with AI |
| `c` | copy command |
| type anything | live search |
| `tab` | cycle filter: all → alias → func → export → ⚠ danger |
| `esc` | clear search |
| `q` | quit |

---

## AI explanations

dotpeek auto-detects whichever AI provider you have available:

| Priority | Provider | How to enable |
|----------|----------|---------------|
| 1 | Groq (free) | `export GROQ_API_KEY="..."` |
| 2 | Claude CLI | install `@anthropic-ai/claude-code` |
| 3 | Gemini CLI | install `@google/gemini-cli` |
| 4 | Anthropic API | `export ANTHROPIC_API_KEY="..."` |
| 5 | OpenAI API | `export OPENAI_API_KEY="..."` |

No config file needed — just set a key and dotpeek picks it up. Results are cached in `~/.dotpeek_ai_cache.json` so the same command is never fetched twice.

Get a free Groq key at **console.groq.com** — 14,400 requests/day, no billing required.

---

## What it reads

dotpeek auto-discovers these files:

| File | Shell |
|------|-------|
| `~/.bashrc` | bash |
| `~/.bash_profile` | bash |
| `~/.bash_aliases` | bash |
| `~/.zshrc` | zsh |
| `~/.zprofile` | zsh |
| `~/.zshenv` | zsh |
| `~/.aliases` | any |
| `~/.functions` | any |
| `~/.exports` | any |
| `~/.profile` | POSIX |
| `~/.config/fish/config.fish` | fish |

It also scans `~/.dotfiles/`, `~/dotfiles/`, and `~/.config/shell/` for any `*.sh`, `*.bash`, or `*.zsh` files.

---

## What it parses

**Aliases**
```bash
alias gs='git status'
```

**Functions**
```bash
function deploy() {
  git push origin main && ./deploy.sh
}
```

**Exports**
```bash
export EDITOR=nvim
```

Add a comment above any command and dotpeek uses it as the description:

```bash
# Push to main and run deploy script
alias deploy='git push origin main && ./deploy.sh'
```

---

## Roadmap

- [x] Shell integration — `peek` shortcut + `ctrl+p` widget via `dotpeek init`
- [ ] `dotpeek annotate` — write AI descriptions back into your dotfile as comments
- [ ] Config file at `~/.config/dotpeek/config.toml`
- [ ] `.env` file support
- [ ] Shell completion for `dotpeek search`

---

## Contributing

PRs and issues welcome. Built with TypeScript, zero runtime dependencies.

```bash
git clone https://github.com/estifanosbereket1/dotpeek
cd dotpeek
npm install
npm run build
npm link
dotpeek
```

---

## License

MIT
