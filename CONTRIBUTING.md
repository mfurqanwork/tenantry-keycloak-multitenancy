# Contributing to Tenantry

Thanks for helping. Please read [AGENTS.md](AGENTS.md) first: its hard rules apply to every change.

## Setup

1. Install Docker Desktop, Node 22+ and pnpm 10.
2. Run `pnpm install`, then `pnpm dev:stack`.
3. Run `pnpm smoke` to check that everything answers.

For day-to-day work, `pnpm dev` keeps the API and the apps on your machine with hot reload.

## Making a change

- Branch from `main`.
- Write the failing test first, then the code.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(api): ...`, `fix(ui): ...`, `docs: ...`.
- Before opening a PR, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Pull request checklist

- [ ] Tests cover the change, and the suite passes.
- [ ] If the change touches tenant data or a new endpoint, it includes an isolation test.
- [ ] If the change alters a recorded decision, `docs/decisions/` has a new or updated ADR.
- [ ] New screens start from a page pattern and use Carbon components and tokens only.
- [ ] New environment variables are in `.env.example`.
