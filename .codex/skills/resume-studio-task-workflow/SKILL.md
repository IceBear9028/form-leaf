---
name: resume-studio-task-workflow
description: Plan, design, implement, validate, and hand off Formleaf (formerly Resume Studio) tasks. Use for task documentation, per-feature code designs, PR summaries, template changes, new features and refactors, or continuing a documented task. Exclude factual questions and status checks that need no repository changes.
---

# Formleaf Task Workflow

Resume the documented task and keep repository evidence, user scope, and actual implementation status distinct. The skill ID is retained for existing callers.

## Inspect and choose scope

Read applicable AGENTS.md, docs/README.md, the current task README, planning, implementation design, feature test plans/results, plan and handoff, relevant code, git status and uncommitted diffs. Preserve unrelated user changes. A request to continue or reformat documents does not create a new numbered task or authorize implementation.

For documentation or template work, read [references/documentation.md](references/documentation.md). It defines information ownership, As-Is/To-Be and Mermaid rules, optional document criteria, and source templates. Use Korean for project documents unless requested otherwise.

For PR drafting, read [references/pull-requests.md](references/pull-requests.md) and use the canonical [GitHub PR template](../../../.github/PULL_REQUEST_TEMPLATE.md). Summarize the final diff and feature-level before/after behavior; link detailed designs and dated validation evidence.

## Create or update the document set

Create a numbered task only for a concrete new task; use the next numeric prefix under docs and update docs/README.md. Keep an existing task directory when continuing it. Do not rewrite completed tasks merely to apply a newer format.

Before drafting detailed documents, identify the feature units by their change purpose, contract, acceptance criteria and completion boundary. A shared task title or technical theme does not make several units a single feature. Establish the feature map in features/README.md first, then create matching numbered planning, implementation and test documents. Follow the [feature decomposition and consolidation criteria](references/documentation.md#기능-분리와-통합-판단); this is an authoring step, not an additional approval requirement.

Use these canonical assets; replace placeholders, remove authoring comments and unused optional sections/links:

| Output | Template | When |
|---|---|---|
| README.md | [task-readme](assets/task-readme.md.template) | Short introduction, key changes and document navigation |
| features/README.md | [features-readme](assets/features-readme.md.template) | Overall planning: problem, users, goals, scope, success and feature index |
| features/NN-name.md | [feature](assets/feature.md.template) | Independently detailed feature planning; match the implementation filename |
| implementation/README.md | [implementation-readme](assets/implementation-readme.md.template) | Technical summary, shared decisions, architecture and design navigation |
| implementation/NN-name.md | [feature-implementation](assets/feature-implementation.md.template) | Before coding: code changes, reasons, flows, contracts, failures and verification |
| tests/README.md | [tests-readme](assets/tests-readme.md.template) | Test index, shared environment, common checks and their results |
| tests/NN-name.md | [feature-tests](assets/feature-tests.md.template) | Matching feature scenarios, pass criteria and actual run evidence |
| plan.md | [plan](assets/plan.md.template) | Dependencies, execution order, completion gates, status and feature commits |
| handoff.md | [handoff](assets/handoff.md.template) | Current actual state, validation evidence, limits and resumption point |
| implementation/<topic>.md | [runtime-flows](assets/runtime-flows.md.template) or [tool-contracts](assets/tool-contracts.md.template) | Optional only: long shared flows or contracts needing a separate owner |

features owns requirements and acceptance criteria; implementation owns code design and verification boundaries; tests owns detailed scenarios, procedures, pass criteria and actual results. Keep the same number and filename across all three directories. Plan owns execution status and commits; handoff summarizes test results with links rather than duplicating run logs. Keep the root README brief. features/README.md owns the full feature map; implementation/README.md summarizes architecture and links detailed designs. Do not create a root design.md or mandatory runtime-flows.md/tool-contracts.md in the new format. Exact contracts and sequences normally belong in the relevant feature implementation design. Split long shared content within implementation/ only when necessary and link its single owner.

Before code changes, write the corresponding implementation design: inspected current files/symbols, proposed changes and purpose, call/data flow, input/output contracts, state and failure boundaries, alternatives, and verification. Keep product requirements in features; link rather than duplicate them. Consolidate only when the linked criteria support it; record the reason and where the consolidated content lives. Trivial changes can use an existing task document or PR summary. Do not force the whole file set or split every option into a feature. Remove unused sections and links. Reuse these assets; docs/templates/README.md is an index, not a second template source.

When consolidating documents, preserve unique requirements and research evidence, move them to their owner, update all callers, and only then remove superseded files. Do not remove technical explanations just to reduce repetition.

## Design and implement according to the request

- Read code before describing As-Is; link symbols and identify the source revision. Mark To-Be as proposed until implemented and verified.
- Explain data creation, transfer, storage, state ownership, commit and failure boundaries. In implementation designs, use Mermaid flowcharts for code logic and branches, sequence diagrams for data movement and call/completion order, and class diagrams for class/function dependencies. Include existing flows and lifetimes when understanding them is necessary to assess the change; the absence of new layers or classes is not an omission reason. Follow the purpose-specific rules in documentation.md; represent free functions as module members, not invented classes. Omit only unnecessary or already-covered views, explaining the scope or linking the existing diagram.
- Record realistic alternatives, costs, revisit conditions and unresolved choices with validation methods. Do not invent user research, scale targets, or product requirements.
- Keep UI behavior, domain validation, persistence and external integrations within their documented boundaries. Preserve canonical document formats and editor ownership unless explicitly changing them.
- For implementation, make coherent increments and validate the affected boundary. Update design when evidence changes it, plan when a stage completes, and handoff with actual results.
- Before implementation starts, every implementation phase remains waiting. During implementation mark one phase in progress. Documentation completion is not product completion.
- Before coding a feature, make its affected files/symbols, before/after behavior, implementation approach and validation plan reviewable. Mark unresolved decisions and their impact. This is a documentation step, not an additional approval requirement; follow the user's requested scope for proceeding to code. Keep designs current when implementation changes them.

### Finish and commit each numbered feature

For authorized implementation work organized as features/NN-name.md, finish one numbered feature before starting the next in the dependency order recorded in plan. Write its test plan before coding, complete implementation, pass required validation and record actual evidence in tests/NN-name.md, update the affected design/plan/handoff, and commit that feature's code, tests and documentation together. Do not accumulate multiple completed features into one later commit; intermediate commits within a feature are allowed.

Include the feature ID in the commit message (for example, `feat(F03): support document content edits`). After the commit succeeds, record its hash in plan before starting the next feature. This bookkeeping change can remain for the next commit; do not amend repeatedly to embed a commit's own hash. Handoff should identify the last completed feature and next action, linking plan for the commit record.

Required checks must pass before completion. If validation or committing is blocked, record the cause and resume that feature; do not mark it complete or start the next feature. Preserve unrelated changes and stage only the feature's scope. Shared prerequisites should be explicit prior work units in plan and committed before dependent features start.

## Product and authorization boundaries

Keep application code under client and task documents under docs. Keep the local-first desktop architecture; add local or remote integrations only within the user-authorized task. Maintain Tailwind for application chrome and the dedicated style system for printable document layout.

Do not hardcode personal resume content or modify actual user data/backups for tests. Treat Electron userData, including the historical Resume Studio directory, as private data. Preserve uncommitted changes. The user has authorized the per-feature commits described above for requested implementation work; do not ask again at each feature boundary. Outside that workflow, commit only when requested. This rule does not authorize push, PR creation or merge by itself.

## Validate and hand off

For documentation-only changes, perform the [structure review](references/documentation.md#구조-검토와-문법-검사를-분리한다) before syntax checks: assess feature decomposition and consolidation reasons, then verify planning/design/test correspondence, acceptance-criteria-to-test coverage, plan coverage and handoff state. A single feature row or matching filenames alone does not prove appropriate decomposition. Separately check relative links/anchors, JSON examples, placeholder and reference consistency, whitespace, and affected Mermaid diagrams. Report structure review and syntax results separately. Do not run product suites merely because a template lists them. For application changes run relevant checks, then required project gates (normally npm test, npm run typecheck, npm run build from client). Use isolated fixtures and hidden/headless verification for app/PDF flows.

Run git diff --check and inspect untracked documentation too. Changed templates must be checked as templates: placeholders are intentional there, but instantiated documents must not retain them. When editing this skill, validate frontmatter and metadata and confirm referenced assets exist.

Keep handoff focused on current status, actual changes, commands/results and their limits, unresolved issues and the next action. Dated historical evidence may follow. Mark the product task complete only when its completion criteria pass. End with the outcome, important limitations, document links and commit state. When delivering a task document set, identify the feature index, tests, plan and handoff locations; link the containing section if legitimately consolidated rather than implying a file exists.
