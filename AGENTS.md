# Kid Maze repository instructions

## Versioning

Kid Maze uses Semantic Versioning (`MAJOR.MINOR.PATCH`). `package.json` is the single source of truth for the application version.

Every future repository change that is committed must also increment the version before the commit. Keep `package-lock.json` synchronized with `package.json`.

Choose the increment according to SemVer:
- PATCH for fixes, polish, refactors, documentation, build/deployment changes, and other backward-compatible maintenance.
- MINOR for new backward-compatible user-facing functionality.
- MAJOR only for intentionally incompatible or breaking changes.

Do not create a separate version-only commit. Include the version bump in the same commit as the change it describes.
