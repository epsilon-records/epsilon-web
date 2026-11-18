# Notes for agents

This file is the single source of truth for every coding agent working in this repo (Claude, Codex, others). `CLAUDE.md` is a symlink to it; edit here only.

## Project rules

- The Epsilon Records label site, epsilonrecords.com (`public/`), plus the Storybook hub (`storybook-hub/`), owned by the Growth orchestrator (paused) and worked on by Codex (shared 0099). Decisions live in the private `epsilon-records/knowledge` repo, under `epsilon-web/decisions/` and `shared/decisions/`. Read them before proposing changes; record new decisions there, not here.
- Design: the shared canon, `knowledge/shared/design/tokens.css` and `components.md`: plain static HTML and one stylesheet, no framework, no Tailwind, no build step (see README).
- Copy: name no other vendor's products. Metric units, 24-hour time and European dates.
- This repo is public: never describe a security hole in an issue, PR or commit here.

## Commands

- Static HTML in `public/`, served by Netlify with no build step. Before finishing, run `node scripts/check.mjs` and `node scripts/check-analytics.mjs` and CI; say in the PR what you ran.

## Chain of command

- Nate is the board. The Oracle (a Claude session) is the only agent that talks to him, and its decisions are final.
- Worker agents take one issue at a time and deliver it as one PR. Codex takes only issues labelled `agent:codex`, and never takes issues assigned to another agent.

## How to work

- Branch from `main` (`codex/<issue#>-<slug>` for Codex). Never push to `main`.
- Keep each PR small and single-purpose, and include "Closes #<n>", a summary, test evidence and risks. CI must be green.
- If a PR makes a lasting decision, draft the decision record in the PR description so it can be filed in `epsilon-records/knowledge`.

## Never do these (raise them instead)

- Merge, deploy, or change production settings (Netlify, DNS, Kit).
- Change prices, newsletter or analytics setup, or privacy text without an issue that asks for it.
- Delete data, branches or files outside the issue's scope.
- Add paid services, contact anyone outside the company, or touch contracts. Never commit secrets.

## Blockers and reporting

- Messages to other agents (board issues and replies, status comments, Codex escalations) follow the agent message protocol, [kb:protocols/agent-messages.md](https://github.com/epsilon-records/knowledge/blob/main/protocols/agent-messages.md), using the terms in [kb:glossary.md](https://github.com/epsilon-records/knowledge/blob/main/glossary.md).
- Never stop silently. Post the blocker to the message board in `epsilon-records/knowledge` as an issue labelled `to:oracle`, with your options and a recommendation, link it from the issue, and carry on with anything that doesn't depend on the answer.
- When done, comment on the issue with what changed, the PR link, what's left and the next issue you'd suggest.
