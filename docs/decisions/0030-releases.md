# ADR-0030: One version and a hand-written changelog

Status: Accepted · Date: 2026-11-10

## Context

Tenantry deploys from version tags, so a version has to mean something. It is one deployed product, and its packages are private.

## Decision

- **One version**, in the root `package.json`. Internal packages stay at `0.0.0`.
- **`CHANGELOG.md` stays hand-written** in Keep a Changelog form. CI fails a pull request that changes `apps/`, `packages/` or `infra/` without a line under Unreleased, unless it has the `skip-changelog` label.
- **`pnpm release <version>`** cuts the section, sets the version, commits and tags. A person pushes the tag.
- **A pushed tag** is verified against `package.json` and the changelog, tested, published as images and a GitHub Release, and deployed.

## Alternatives considered

- **Generated from commits (release-please, semantic-release):** less effort, but the changelog becomes a list of commit subjects.
- **Changesets:** made for publishing many npm packages, each with its own version.

## Consequences

- Rolling back is deploying an earlier tag.
- Docs-only pull requests need no changelog line. A change under `apps/` with nothing to tell needs the label.
