---
name: resume-studio-task-workflow
description: Plan, document, implement, validate, and hand off Formleaf (formerly Resume Studio) tasks. Use for task documentation or template changes, new features and refactors, or continuing a documented task. Exclude factual questions and status checks that need no repository changes.
---

# Formleaf Task Workflow

Resume the documented task and keep repository evidence, user scope, and actual implementation status distinct. The skill ID is retained for existing callers.

## Inspect and choose scope

Read applicable AGENTS.md, docs/README.md, the current task README/design/plan/handoff, relevant code, git status and uncommitted diffs. Preserve unrelated user changes. A request to continue or reformat documents does not create a new numbered task or authorize implementation.

For documentation or template work, read [references/documentation.md](references/documentation.md). It defines information ownership, As-Is/To-Be and Mermaid rules, optional document criteria, and source templates. Use Korean for project documents unless requested otherwise.

## Create or update the document set

Create a numbered task only for a concrete new task; use the next numeric prefix under docs and update docs/README.md. Keep an existing task directory when continuing it. Do not rewrite completed tasks merely to apply a newer format.

Use these canonical assets; replace placeholders, remove authoring comments and unused optional sections/links:

| Output | Template | When |
|---|---|---|
| README.md | [task-readme](assets/task-readme.md.template) | Default; overall problem, users, goals, success, scope and feature index |
| design.md | [design](assets/design.md.template) | Default; evidence, current/target structure, data ownership, relationships, decisions and risks |
| plan.md | [plan](assets/plan.md.template) | Default; transition, dependencies, gates and implementation status |
| handoff.md | [handoff](assets/handoff.md.template) | Default; actual changes, evidence, unknowns and next action |
| features/NN-name.md | [feature](assets/feature.md.template) | Only for independently detailed user tasks; small features stay in README |
| runtime-flows.md | [runtime-flows](assets/runtime-flows.md.template) | Only when inline design sequences need separate navigation |
| tool-contracts.md | [tool-contracts](assets/tool-contracts.md.template) | Only when exact external/API/IPC contracts need independent maintenance |

README owns the overall feature map. Do not generate an additional features.md/PRD by default. Exact tool/operation catalogs belong in contracts; implementation checklists belong in plan. Reuse shared templates from here rather than copying template guides into each task. docs/templates/README.md is the repository-facing index, not a second set of templates.

When consolidating documents, preserve unique requirements and research evidence, move them to their owner, update all callers, and only then remove superseded files. Do not remove technical explanations just to reduce repetition.

## Design and implement according to the request

- Read code before describing As-Is; link symbols and identify the source revision. Mark To-Be as proposed until implemented and verified.
- Explain data creation, transfer, storage, state ownership, commit and failure boundaries. Use Mermaid for architecture, feature dependencies and representative current/target sequences when they clarify the change. Simple changes can explain why a diagram is unnecessary.
- Record realistic alternatives, costs, revisit conditions and unresolved choices with validation methods. Do not invent user research, scale targets, or product requirements.
- Keep UI behavior, domain validation, persistence and external integrations within their documented boundaries. Preserve canonical document formats and editor ownership unless explicitly changing them.
- For implementation, make coherent increments and validate the affected boundary. Update design when evidence changes it, plan when a stage completes, and handoff with actual results.
- Before implementation starts, every implementation phase remains waiting. During implementation mark one phase in progress. Documentation completion is not product completion.

## Product and authorization boundaries

Keep application code under client and task documents under docs. Keep the local-first desktop architecture; add local or remote integrations only within the user-authorized task. Maintain Tailwind for application chrome and the dedicated style system for printable document layout.

Do not hardcode personal resume content or modify actual user data/backups for tests. Treat Electron userData, including the historical Resume Studio directory, as private data. Preserve uncommitted changes. Do not commit unless requested.

## Validate and hand off

For documentation-only changes, check relative links/anchors, JSON examples, placeholder and reference consistency, whitespace, and affected Mermaid diagrams. Do not run product suites merely because a template lists them. For application changes run relevant checks, then required project gates (normally npm test, npm run typecheck, npm run build from client). Use isolated fixtures and hidden/headless verification for app/PDF flows.

Run git diff --check and inspect untracked documentation too. Changed templates must be checked as templates: placeholders are intentional there, but instantiated documents must not retain them. When editing this skill, validate frontmatter and metadata and confirm referenced assets exist.

Keep handoff focused on current status, actual changes, commands/results and their limits, unresolved issues and the next action. Dated historical evidence may follow. Mark the product task complete only when its completion criteria pass. End with the outcome, important limitations, document links and commit state.
