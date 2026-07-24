---
name: qa-pmo-context-triage
description: Lightweight context triage for ma-garin/sandbox QA-PMO work. Use when the user asks about QA-PMO, the VeriServe quality portal, AIDD kit, portal, platform, validation research, GitHub Pages, PMO tools, or next actions in the sandbox repository.
---

# QA-PMO Context Triage

## Overview

Use this skill to understand the QA-PMO repository without pulling too much context. The goal is to identify the correct subsystem, avoid confusing current and legacy implementations, and propose the cheapest useful next action.

## Repository Facts

- Repository: `ma-garin/sandbox`
- Main project: `QA-PMO/`
- Current production-like system: `QA-PMO/portal/` (Django)
- Reference or legacy implementations: `QA-PMO/platform/` and `QA-PMO/pmo-menu.html`
- Personalization assets: `QA-PMO/yuki-aidd-kit/`
- Validation research: `QA-PMO/validation/`
- Project state file: `QA-PMO/CURRENT_STATE.md`

Important nuance: `QA-PMO/README.md` says `portal/` is the current Django system, while `CURRENT_STATE.md` may describe completed `platform/` phase work. Always confirm the intended target before editing or recommending deployment.

## Minimal Read Order

Read only as much as needed:

1. Root `README.md` to confirm sandbox rules.
2. `QA-PMO/README.md` to confirm subsystem ownership and current/legacy status.
3. `QA-PMO/CURRENT_STATE.md` to identify recent state and next-phase candidates.
4. The target subsystem README only:
   - `QA-PMO/portal/README.md` for Django portal work.
   - `QA-PMO/platform/README.md` for static/GitHub Pages work.
   - `QA-PMO/yuki-aidd-kit/README.md` for Skills, agents, templates, and workflow kit work.
   - `QA-PMO/validation/README.md` for validation research work.

If the repository is not checked out locally, use compact GitHub connector or `gh api --jq` calls for file lists and specific text files only. Avoid broad contents recursion, full source downloads, Actions logs, or PR/issue dumps unless the user approves.

## Triage Output

Return a short triage with:

- Target subsystem: `portal`, `platform`, `yuki-aidd-kit`, `validation`, or unknown.
- Evidence: 2-4 bullets naming the files inspected.
- Risk: the main way the task could go wrong.
- Cheapest validation: one low-cost check before heavier work.
- Next action: 1-3 concrete steps, with approval gates if needed.

## Common Decisions

- For GitHub Pages deployment, confirm whether the target is the static `platform/` rather than the current Django `portal/`.
- For portal feature work, treat Django commands, dependency installs, migrations, and test runs as approval-gated unless already requested.
- For AIDD kit work, prefer small Skill changes and `agents/openai.yaml` metadata before building MCP or Plugin infrastructure.
- For validation research, keep claims evidence-only and preserve the current caveat that N=20 has limited statistical power.
- For UI work, combine with existing design and QA standards where available.

## Approval Gates

Ask before cloning, installing dependencies, running Django migrations, running browser checks, deploying Pages, pushing commits, opening PRs, or merging.
