# lesson-skill-loop

Turn your development lessons into reusable skills — automatically.

**[日本語版 README](README.ja.md)**

## What It Does

Developers accumulate lessons from bugs, incidents, and mistakes. These lessons sit in markdown files and are rarely revisited. This tool closes the loop:

```
Lessons (past mistakes) → Analysis → Skill proposals → Skills (checklists)
                                                            ↓
                                                       Skills used
                                                            ↓
                                                       New lessons
                                                            ↓
                                                   Skill improvements
```

## Quick Start

```bash
git clone https://github.com/aliksir/lesson-skill-loop.git
cd lesson-skill-loop

# Try with sample data
bash lesson-skill-check.sh examples/lessons

# Use with your own lessons
bash lesson-skill-check.sh /path/to/your/lessons
```

## Modes

| Mode | Command | What it does |
|------|---------|-------------|
| **Analyze** | `bash lesson-skill-check.sh [dir]` | Count tags, propose skills for patterns appearing 3+ times |
| **Sync** | `bash lesson-skill-check.sh --sync [dir]` | Compare existing skills with lessons, find unreflected entries |
| **Health** | `bash lesson-skill-check.sh --health [dir]` | Check skill freshness and evidence strength |
| **Map** | `bash lesson-skill-check.sh --map [dir]` | Full traceability: which lessons back which skills (with full text) |
| **All** | `bash lesson-skill-check.sh --all [dir]` | Run all modes |

## Lesson File Format

Lessons are markdown files with tagged headings:

```markdown
### Rate Limiting `[api]` `[auth]`
- **Always check rate limit headers**: X-RateLimit-Remaining tells you...
- **Implement exponential backoff**: Start at 1s, double each retry...
```

Tags in `[brackets]` are the key. When the same tag appears in 3+ headings, the tool proposes creating a skill (checklist) for that pattern.

## Skill Format

Skills are Claude Code compatible checklists:

```markdown
---
name: api-checklist
description: API integration checklist based on past lessons.
---

# API Integration Checklist

- [ ] **Rate limit handling**: Check X-RateLimit-Remaining
- [ ] **API keys in env vars**: No hardcoded secrets
```

Skills named `*-checklist` are automatically detected by `--sync` and `--health`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LESSON_SKILL_LESSONS_DIR` | `./examples/lessons` | Path to lesson files |
| `LESSON_SKILL_SKILLS_DIR` | `~/.claude/skills` | Path to skill directories |

## How It Works with Claude Code

1. **You work** — bugs happen, lessons are recorded in `lessons/*.md` with tags
2. **Run the tool** — `bash lesson-skill-check.sh --all` shows what patterns repeat
3. **Create skills** — use `/skill-creator` in Claude Code to turn proposals into skills
4. **Skills improve** — `--sync` detects new lessons that should update existing skills
5. **Skills retire** — `--health` flags skills with weak evidence or stale content

## Inspired By

- [EvoSkill](https://arxiv.org/abs/2603.02766) — Automated skill discovery for multi-agent systems
- [Neko Gundan](https://github.com/aliksir/neko-gundan) — Multi-agent orchestration for Claude Code

## License

MIT
