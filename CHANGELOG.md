# Changelog

## [2.3.0] - 2026-04-12

### Added
- `--for <project-path>`: Stack-aware lesson filter — detect the project's technology stack from manifest files and filter lessons to those relevant to the detected stack. Complements `autoskills` by providing stack-to-past-failures linkage (rather than stack-to-generic-skills distribution).
- Stack detection for 6 languages / 8 manifest types:
  - **JavaScript / TypeScript**: `package.json`
  - **Python**: `requirements.txt`, `pyproject.toml`, `Pipfile`
  - **Rust**: `Cargo.toml` (incl. `[workspace.dependencies]`, `[build-dependencies]`, `[dependencies.foo]` table form)
  - **Go**: `go.mod`
  - **Ruby**: `Gemfile`
  - **PHP**: `composer.json` (with non-framework vendor blacklist)
- Framework hierarchy in tag mapping: `next` → `[react]`, `nuxt` → `[vue]`, etc.
- `hardTags` / `softTags` split: filter uses hardTags only (precision); softTags shown for related context (recall).
- UTF-8 BOM handling for all manifest parsers.
- Monorepo: explicitly not supported in v2.3.0 (only top-level manifests scanned). Planned for v2.4.0.

### JSON Schema
- `--for` specified: adds `stack` field at top level with `{ projectDir, languages, technologies, sources, hardTags, softTags, errors }`.
- `--for` not specified: JSON output is **byte-for-byte identical** to v2.2.x for single modes (analyze, sync, health, map).
- `--all --json`: now includes `mode: "all"` at top level for consistency with single modes (which already had `mode`). This is a backward-compatible field addition.
- `--all --json --for`: `stack` appears **once at top level only**, not duplicated in each mode object.

### Tests
- 33 new tests covering all 8 parsers, stack detection integration, CLI option validation, BOM handling, `[[array-of-tables]]` edge cases, Cargo workspace, framework hierarchy, backward compatibility, and `--all --json` schema.
- Total: 32 → 65 tests. Test file: 403 → 902 lines.

### Design & Review
- Design spec reviewed 4 times via `codex` CLI (v1 → v2 → v3 → v4 APPROVE). 29 review findings total, all resolved or intentionally deferred to v2.4.0.

## [2.2.1] - 2026-03-22

### Fixed
- `bin` entry was stripped during `npm publish` because `.mjs` extension is invalid for bin scripts. Renamed `skill-loop.mjs` → `skill-loop.js` (`"type": "module"` ensures ESM behavior is preserved)

## [2.2.0] - 2026-03-22

### Fixed
- Tag regex: exclude Markdown checkboxes (`[x]`, `[ ]`) and meta expressions (`[N/A]`) from tag extraction. Tags are now only counted in heading lines (`### ...`)
- Exit code: return exit code 1 when no lesson files are found (was incorrectly returning 0)

### Added
- Automated tests: `test/skill-loop.test.mjs` using `node:test` + `node:assert` (zero dependencies maintained)

### Removed
- `lesson-skill-check.sh`: Bash version removed (deprecated in v2.1.0, replaced by Node.js implementation)
- `check-update.sh`: Removed (replaced by `--self-update` flag in v2.1.0)

### Changed
- `package.json`: `test` script now runs `node --test test/skill-loop.test.mjs`
- README: Simplified "Migrating from Bash version" section, added Plugin structure (commands/) documentation

## [2.1.0] - 2026-03-17

### Added
- `--self-update`: Update tool itself via `npm install -g claude-skill-loop@latest`
- Automatic npm version check after scan (suppressible with `--no-version-check`)
- `--no-version-check`: Disable npm version check (for CI)

### Deprecated
- `lesson-skill-check.sh`: Use `skill-loop.mjs` (Node.js version) instead

## [2.0.1] - 2026-03-16

### Fixed
- NPM package configuration and publish setup

## [2.0.0] - 2026-03-16

### Changed
- Complete rewrite from Bash to Node.js (skill-loop.mjs)
- Added --map mode (traceability map with full section text)
- Added --json output mode
- Added environment variable configuration
- Added --threshold option

## [1.0.0] - 2026-03-15

### Initial release
- Bash-based lesson-skill analysis (lesson-skill-check.sh)
- Tag pattern analysis and skill candidate suggestions
- Skill-lesson sync check
- Health check (freshness, evidence strength)
