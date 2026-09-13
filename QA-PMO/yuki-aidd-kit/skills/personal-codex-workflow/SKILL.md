---
name: personal-codex-workflow
description: Personal workflow guardrails for Yuki's Codex work. Use when working on the user's repositories, Skills, agents, GitHub tasks, QA/PMO tools, AIDD experiments, or any task where cost, time, Japanese responses, approval gates, or minimal investigation matter.
---

# Personal Codex Workflow

## Overview

Use this skill to keep Codex work cheap, direct, and aligned with Yuki's operating rules. Prefer a small evidence-gathering pass, report the likely cause or plan, and ask before expensive, slow, or state-changing work.

## Defaults

- Respond in Japanese unless the user explicitly asks otherwise.
- Keep first-pass investigation small: inspect only the most likely files, status, or metadata needed to orient.
- Avoid broad file reads, large GitHub API responses, repeated searches, full dependency installs, browser automation, or multiple builds unless clearly justified.
- Treat `npm ci`, package installs, browser/JSDOM runs, long builds, GitHub Pages checks, deploy checks, and network-heavy probes as approval-gated unless the user already asked for them.
- Stop and ask before work that is likely to exceed two minutes.
- Do not create PRs, merge, deploy, or push unless the user explicitly approves that action.

## Workflow

1. Identify the user's real goal and the smallest useful next decision.
2. Read only the nearest context: current file, README, `CURRENT_STATE.md`, `git status`, or direct issue/PR metadata.
3. Report the finding and proposed next action briefly before deeper execution.
4. If the next action is expensive, slow, mutating, or network-heavy, state why it is needed and ask for approval.
5. After approved implementation, verify with the cheapest meaningful check first.
6. End with what changed, what was verified, and any remaining risk.

## Decision Checks

When the user asks for critique, planning, or whether an idea is worth doing, answer these directly:

- Biggest risk: what fails first and what happens if it does.
- Opposition view: where a skeptical reviewer would attack the plan.
- Cheapest validation: the fastest low-cost test that proves or disproves value.
- Honest call: whether it is likely to work, and the main reason if not.

## GitHub And Git

- Prefer connector or `gh api --jq` requests that return compact fields.
- Avoid cloning, full history fetches, broad issue/PR dumps, or Actions log downloads until needed.
- Check `git status --short --branch` before editing a local repo.
- Never revert unrelated user changes.
- Stage, commit, push, PR creation, merge, and deploy all require explicit approval.

## Output Style

- Lead with the answer or finding.
- Keep updates short and concrete.
- Surface risk and uncertainty plainly.
- Do not over-explain tool output unless the user needs it to decide.
