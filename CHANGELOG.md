# Changelog

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
