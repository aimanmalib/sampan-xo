# Notes for coding agents

- Node 22, TypeScript strict, ES modules, `tsx` for scripts, vitest for tests. Pin dependency versions exactly.
- Chipnet, except one minimum mainnet Landing run (land, then giveBack) set in `config/mainnet.json`; its limits are checked in `src/landing-network.ts`. No other mainnet transactions, no real tokens.
- Never print or commit wallet phrases. `.env` stays untracked; `.env.example` lists variable names only.
- Values that may change belong in `config/chipnet.json`, not in code.
- Keep modules small. Entry points in `scripts/` stay thin; logic lives in `src/` and `template/`.
- Offline gate: `bash scripts/gerbang-ujian.sh` (typecheck and unit tests, no network).
- `JOURNAL.md` is written during the work: timestamped UTC entries, facts only, verbatim errors.
- `FEEDBACK.md` is written by the entrant by hand. Agents do not write, draft, edit or polish it.
- Commit messages and all tracked text in English.
