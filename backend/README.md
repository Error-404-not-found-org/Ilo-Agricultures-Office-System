# BreedSmart Backend

This is the active modernized BreedSmart API folder. The previous backend folder should be treated as a rollback backup only if it still exists locally.

## Setup

1. Copy `.env.example` to `.env` and set local values.
2. Run `npm install`.
3. Run `npm run check` before starting the API.

## Modernization rules

- Preserve existing API behavior while moving workflows into services.
- Keep livestock calculations pure in `src/domain`.
- Use timeline and audit services for significant animal, breeding, and health changes.
- Do not commit credentials, generated files, or dependency folders.
