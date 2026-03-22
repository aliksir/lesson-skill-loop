# Changelog

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
