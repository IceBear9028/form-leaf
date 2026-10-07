---
name: resume-studio-task-workflow
description: Plan, implement, validate, document, and hand off Resume Studio development tasks across Codex sessions. Use when the user starts a new Resume Studio feature or refactor, asks to continue an existing implementation, requests task planning documents together with code changes, or needs durable handoff notes for another session. Do not trigger for a simple factual question or status check that requires no repository changes.
---

# Resume Studio Task Workflow

Carry one concrete Resume Studio task from repository inspection through documented handoff. Treat repository files, not prior chat history, as the durable source of truth.

## 1. Inspect before planning

Read these sources before editing:

1. Repository-level `AGENTS.md` files, when present.
2. `docs/README.md` and the active task directory it identifies.
3. Relevant design documents in that task directory.
4. `git status --short`, recent commits, and the relevant code paths.
5. Existing uncommitted diffs. Preserve user-owned changes and do not overwrite unrelated work.

If the user says to continue, resume the active documented task. Do not create a duplicate task directory.

## 2. Establish a new task unit

Create a task unit only after the user gives a concrete goal. Do not pre-create future work.

1. Find the highest numeric prefix under `docs/`.
2. Allocate the next two-digit number.
3. Create `docs/<NN>-<short-kebab-name>/`.
4. Instantiate these files from `assets/`, replacing every placeholder:
   - `README.md` from `assets/task-readme.md.template`
   - `plan.md` from `assets/plan.md.template`
   - `design.md` from `assets/design.md.template`
   - `handoff.md` from `assets/handoff.md.template`
5. Update the table in `docs/README.md` to show the new task as active.

Use Korean for project documents unless the user requests another language.

## 3. Plan before implementation

Record only decisions supported by the current request or repository evidence.

- Define the problem, user experience, scope, exclusions, and measurable completion criteria in the task `README.md`.
- Break implementation into independently verifiable phases in `plan.md`.
- Describe affected components, data flow, persistence, failure handling, and alternatives in `design.md`.
- Mark exactly one plan phase as in progress.
- Call out unresolved choices without inventing product requirements.

Ask the user only when a missing decision would materially change the product or data model. Otherwise, make a narrow reversible assumption and record it.

## 4. Preserve Resume Studio boundaries

Follow these project-specific rules:

- Keep desktop application code under `client/` and task documentation under `docs/`.
- Use Tailwind CSS for application chrome and editor UI.
- Keep printable resume layout rules in the dedicated resume CSS/style system; do not convert them to Tailwind utilities.
- Keep the app local-first and serverless unless the user explicitly changes that requirement.
- Do not hardcode a user's resume, contact details, links, or imported document as application defaults.
- Treat files under `~/Library/Application Support/Resume Studio/` as user data. Never add them to Git.
- Do not create, rewrite, summarize, or silently shorten resume prose unless explicitly asked.
- Preserve reusable structured data boundaries so the same resume data can later feed portfolio renderers.
- Do not add speculative features merely for possible future use.
- Do not commit unless the user explicitly asks.

## 5. Implement in small verified increments

For each phase:

1. Inspect the exact code path and its callers.
2. Update `design.md` if implementation evidence changes the design.
3. Make the smallest coherent code change.
4. Run validation proportional to risk.
5. Update `plan.md` immediately: complete the finished phase and select the next one.
6. Update `handoff.md` whenever the session could safely stop.

For visual/PDF work, compare the rendered output with the supplied reference at the same page and scale. Validate layout and content separately.

## 6. Validate completion

Run the narrowest relevant checks first, then the full project checks. For application changes, normally run from `client/`:

```text
npm run typecheck
npm run build
```

Also run targeted smoke, PDF, persistence, or import/export checks when the changed behavior requires them. Record commands and results in `handoff.md`; do not write “verified” without evidence.

Before finishing:

- Run `git diff --check`.
- Confirm no personal data or local workspace JSON entered the Git diff.
- Confirm task docs match the implementation rather than the original guess.
- Mark the task complete in both its `README.md` and `docs/README.md` only when all completion criteria pass.

## 7. Prepare cross-session handoff

Keep `handoff.md` concise and operational. Include:

- current status and active phase;
- completed behavior;
- modified files;
- validation commands and outcomes;
- unresolved issues or decisions;
- exact next action;
- whether changes are committed and the commit hash when applicable.

Never rely on “as discussed earlier.” Write enough repository-grounded context for a new session to continue without the old conversation.

When handing work back to the user, lead with the outcome, mention validation, link the task documents, and state whether the worktree is committed.
