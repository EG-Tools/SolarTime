# Shared Agent Constitution

## Scope And Precedence
- Applies to agent work in `ReStartHuman`, `ThinkStock`, `MagicNumber`, and `SpaceO` under `D:\_Program`.
- This is the shared baseline among repository guides. A repository-local `AGENTS.md` MAY add stricter or product-specific rules, but MUST NOT weaken this baseline.
- Apply a rule only when its subject exists in the target project. Absence of a UI, cache, network layer, background task, or other optional subsystem does not require creating one.
- Treat this file as execution constraints for agents, not as user-facing documentation.

## Mandatory Reasoning Model
- Before editing, identify the requested outcome, the invariant that must remain true, the authoritative owner, inputs, outputs, lifecycle, failure modes, and affected tests.
- Prefer a root-cause change at the authoritative owner over a symptom patch at a consumer.
- Implement the general rule once. Model exceptional behavior as an explicit option, policy, adapter, or strategy beneath that rule.
- Do not infer a new abstraction from one hypothetical use. Generalize only when an active requirement or repeated implementation proves the shared concept.

## Ownership And Derivation
- Every mutable state domain, operation, resource, and lifecycle MUST have one authoritative owner.
- Consumers MUST receive snapshots, selectors, events, commands, or injected dependencies; they MUST NOT maintain an unsynchronized copy of authoritative state.
- Values that can be derived from authoritative inputs MUST remain derived. Persist or cache a derived value only with an explicit invalidation contract.
- Related state changes that represent one logical action SHOULD commit as one transaction so observers cannot see a partially updated state.
- When one object conceptually belongs to another, encode that relationship structurally or through one shared model. Do not maintain duplicate identity, position, status, or lifetime state for the child.

## Reuse And Duplication Gate
- Search the repository for semantically equivalent code, including alternate names, generated variants, environment-specific paths, and legacy fallbacks, before adding an implementation.
- Extend an existing authoritative primitive before creating a new helper, module, store, cache, queue, renderer, popup, scheduler, or controller.
- One behavior MUST NOT have parallel implementations for different callers, devices, environments, buttons, or loading states when parameters or adapters can express the difference.
- If the existing owner cannot safely support the requirement, replace or generalize it and remove the superseded path in the same change.
- A temporary compatibility path MUST have an owner, removal condition, and regression test. It MUST NOT remain as an undocumented fallback.

## Modules And Dependencies
- Modules SHOULD be cohesive around one responsibility and lifecycle. Avoid both large multi-domain files and one-function fragment sprawl.
- Entry files SHOULD orchestrate construction, dependency wiring, and lifecycle only; domain rules belong to domain modules.
- Cross-module dependencies MUST be explicit through imports, exports, constructor arguments, or factory arguments.
- Do not add `globalThis`, `window`, string-based registries, implicit load-order dependencies, or duplicate service locators except at a documented platform boundary.
- Prefer standard `import`/`export`. Boundary adapters MAY expose a minimal global surface when required by a host, worker, generated bundle, or test harness.
- Merge modules that share the same owner and lifecycle. Split a module only when the new boundary is independently understandable, testable, and reusable.

## Events, Async Work, And Concurrency
- High-frequency input or event streams SHOULD coalesce pending work to the latest valid request rather than queue every intermediate request.
- Completion work SHOULD run once after a burst unless every intermediate result is an explicit product requirement.
- Every asynchronous result MUST verify that its request revision, input revision, and owner lifecycle are still current before commit.
- Long-running work MUST support cancellation or supersession when its result can become irrelevant.
- Concurrent requests for the same immutable result SHOULD share one producer; independent consumers MUST retain independent cancellation semantics.
- Retries MUST be bounded, classified by transient versus permanent failure, and owned by the relevant service rather than duplicated by callers.

## Performance And Resource Lifecycle
- Deliver the smallest user-visible critical result first. Defer optional or expensive work unless it is required by an enabled feature or the critical result.
- During active interaction, use the cheapest update that preserves the invariant. Reconcile once after interaction only when reconciliation is actually necessary.
- Reuse immutable or unchanged work. Recompute only inputs whose authoritative revision changed.
- Every timer, listener, worker, process, watcher, browser session, subscription, and background job MUST have an owner and disposal path.
- Background work MUST be bounded, deduplicated, yield to active interaction, and stop when its owner is disposed.
- Do not leave development servers, tests, workers, polling loops, or CPU-intensive processes running after the task.

## Data And Cache Integrity
- Source data and validated current state outrank caches. A cache MUST NOT become an independent authority.
- Persistent caches MUST define schema/version, source revision, freshness policy, bounded retention, validation, and deterministic invalidation.
- Partial, stale, malformed, or lower-priority data MUST NOT replace newer validated data.
- Immutable history SHOULD be reused; only changed or newly available regions SHOULD refresh.
- Source precedence, normalization, merge, retry, and fallback policy belong to one service per data domain, not to individual consumers.
- Equivalent local, deployed, desktop, mobile, or offline paths MUST use the same domain rules when given the same input revision.

## UI Rules When A UI Exists
- Reuse design tokens, shared controls, templates, popup shells, progress components, spacing, typography, animation timing, and hit-area policy.
- Visual size and interaction size are separate shared tokens; do not scatter per-feature hit-radius constants.
- UI attached to another control or component SHOULD live beneath that owner in the layout/component structure so moving the owner does not require a second coordinate edit.
- Product-specific variants extend a shared component through options or modifier classes; they do not clone the component.
- Accessibility state, visible state, stored state, and enabled behavior MUST be driven from one control-state model.

## Validation Contract
- Test the invariant at its authoritative owner, then add integration coverage only at affected system or environment boundaries.
- A duplicate-path fix MUST include a regression test proving the formerly divergent callers now produce the same state or result.
- Test cold and warm state, enabled and disabled state, cancellation, stale async completion, and relevant platform boundaries when they affect the change.
- Do not weaken an assertion, timeout, or tolerance to hide a defect unless measured platform variance justifies the exact change.
- A non-release task is complete when its diff is inspected, proportionate affected checks pass, and spawned resources are stopped. Generated outputs MUST be current when the local product consumes them or before release.

## Proportional Validation Cadence
- Batch validation around a stable logical change. Do not rerun a full suite, full build, browser matrix, or equivalent overlapping check after every small edit.
- Copy-only, comment-only, or token-based visual changes normally require diff inspection only. Add a focused visual check only when layout, interaction, accessibility, or generated output can change.
- During implementation, run only the narrowest check that gives useful feedback for a changed high-risk owner such as data integrity, cache invalidation, date alignment, concurrency, rendering topology, or analysis logic.
- When several edits belong to one feature or fix, finish the coherent source batch first, then run its affected unit or smoke checks once. Rebuild generated artifacts once after that source batch is stable rather than after each edit.
- Reserve the full unit suite, production build, cross-browser or device coverage, data validation, and deployment verification for the final release gate immediately before an explicitly requested deployment, unless the user asks for them earlier or broad diagnosis requires them.
- After a failed check, rerun the failed or directly affected scope while fixing it. Run the full release gate only once more after the fixes are stable; do not repeatedly rerun already-proven unaffected checks.
- Avoid invoking multiple commands that validate the same invariant. Prefer one authoritative validation entry point and record narrower checks already completed so they are not repeated without a new relevant revision.

## Change Discipline
- Preserve unrelated user changes and dirty-worktree content.
- Keep diffs focused, but fix a discovered shared root cause instead of stacking another local patch over it.
- Remove dead branches, stale exports, disconnected listeners, duplicate constants, obsolete generated references, and replaced compatibility code exposed by the change.
- Do not introduce a framework, dependency, service, cache, or abstraction without a current need and a clear owner.
- Version and deployment behavior follow the repository-local release policy. Deploy only when explicitly requested.

## Required Agent Checklist
- Before editing: locate the authoritative owner, existing reusable path, dependency direction, state source, lifecycle, async boundaries, and tests.
- During editing: preserve one owner and one normal path; express exceptions explicitly; coalesce redundant work; remove the superseded path.
- Before finishing: search again for duplicate owners and dead references; verify invalidation, cancellation, and disposal; run only proportionate affected validation; inspect generated output when applicable; confirm no process remains. Apply the full validation matrix only at the release gate defined above.
