# Codex Workspace Instructions

## Scope
- Apply to the entire repository.

## Communication
- Respond in Chinese.
- Keep answers concise unless detailed explanation is requested.

## Project Quick Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Rebuild curriculum data: `npm run rebuild`
- Fetch statements: `npm run statements`

## Validation Before Finishing Changes
- For UI/code changes: run `npm run build`.
- For data changes under `data/raw`: run `npm run rebuild`.

## Important Project Facts
- Tech stack: Vite + React.
- Main app entry: `src/main.jsx`, `src/App.jsx`.
- Curriculum output file: `data/curriculum.json`.
- Problem statements cache: `public/statements/*.json`.

## Editing Rules
- Keep changes minimal and focused on the user request.
- Do not reformat unrelated files.
- Preserve existing behavior unless change is requested.