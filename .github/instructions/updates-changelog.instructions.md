---
description: "Use when completing any product-visible change, feature, or bug fix in this repository. Enforces mandatory Updates page changelog entries in frontend/src/lib/updates.ts before considering a task complete."
name: "Mandatory Updates Changelog"
applyTo: "**"
---
# Mandatory Updates Changelog

This is a hard rule.

- After every completed task, decide whether the work is product-visible.
- If the change is product-visible, add a changelog entry before considering the task done.
- Do not wait for the user to ask for the changelog update.
- Skip purely TypeScript or internal changes with zero UX impact.
- Include technical improvements when users can clearly feel the effect, such as better performance, stronger reliability, or fewer crashes.

## File And Placement

- Update `frontend/src/lib/updates.ts` only.
- Add items under `UPDATE_ENTRIES`.
- Keep newest-first order.
- Maintain one accordion per day.
- Use the local date at task completion as the authoritative "today" date.
- If an entry for today's date exists, add sections to that existing date entry.
- Do not create a second entry for the same date.

## Grouping Rules

- Group updates by category using these sections.
- `BIG_FEATURE`
- `SMALL_FEATURE`
- `BUG_FIX`

## Writing Rules

- Write item text in French.
- Start each item with the user-facing feature name in bold markdown, for example `**Nom de fonctionnalite**`.
- Write for users, not developers.
- Describe what users can do or see.
- Do not describe implementation details, internal mechanics, or UI architecture terms that users do not care about.
- If users cannot notice the change as a feature, do not list it.

## Completion Gate

- Before finishing any task, explicitly check: "Does this warrant a changelog entry?"
- If yes, add the entry immediately as part of the same task.
