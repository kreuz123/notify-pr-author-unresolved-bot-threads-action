# Manual Testing Plan

This document describes a manual test plan for verifying the behavior of
`notify-pr-author-unresolved-bot-threads-action` against a real GitHub
repository. Use it for pre-release regression testing whenever the action's
logic changes.

## 1. Prerequisites

- Create (or reuse) a test repository, and add a workflow file based on the
  [README Usage example](README.md#usage), triggered on `pull_request_review`
  (`types: [submitted]`).
- The workflow should first call
  [`kreuz123/check-all-reviewers-approved-action@v1`](https://github.com/kreuz123/check-all-reviewers-approved-action)
  to obtain the `all-approved` output, then call this action.
- Ensure the workflow `permissions` include `contents: read`,
  `pull-requests: write`, and `issues: write`.
- Prepare at least one human reviewer account and one bot/App-based review
  source (e.g. enable GitHub Copilot code review, or use a GitHub App to
  create review comments). This matters because the action identifies bot
  comments via the GraphQL `Actor.__typename === "Bot"` field, not by
  matching login names.

## 2. Core scenarios (happy path & edge cases)

| # | Scenario | Steps | Expected result |
|---|----------|-------|------------------|
| 1 | All human reviewers approved + unresolved bot review thread exists | Open a PR, have a bot (e.g. Copilot) leave a review comment thread, then have all required human reviewers submit an Approve review. | A notification comment is added to the PR mentioning `@author`, the unresolved count, and a thread list with links. `has-unresolved` = `true`, `unresolved-count` matches the number of bot threads, `thread-list` contains the expected links. |
| 2 | All human reviewers approved + no unresolved bot threads (all resolved or no bot comments) | Resolve all bot threads (or ensure none exist), then have reviewers approve. | No comment is created. `has-unresolved` = `false`, `unresolved-count` = `0`. |
| 3 | Not all human reviewers approved (`all-approved` = false) | Have `check-all-reviewers-approved-action` report `all-approved: false` while an unresolved bot thread exists. | No notification comment is created, regardless of unresolved bot threads. |
| 4 | Bot thread manually resolved before approval | Mark the bot-authored thread as Resolved, then have the reviewer approve. | No comment is created. `has-unresolved` = `false`. |
| 5 | Multiple unresolved bot threads (pagination) | Create enough review threads to exceed 100 (to exercise the GraphQL `pageInfo.hasNextPage` pagination), or at least several threads to produce a multi-line list. | The thread list is numbered correctly, links are correct, and each entry's preview is truncated to 70 characters with a trailing `...` when the body is longer. All threads across pages are included. |
| 6 | Non-bot unresolved thread (left by a human reviewer) | Create an unresolved review comment thread authored by a human reviewer (not a bot). | This thread is **not** counted in `unresolved-count` and does not appear in the notification comment, since `isBotComment` only matches `__typename === "Bot"`. |

## 3. `comment-template` customization scenarios

| # | Scenario | Steps | Expected result |
|---|----------|-------|------------------|
| 7 | Default `comment-template` | Do not set `comment-template`. | The comment uses the default template defined in `action.yml`. |
| 8 | Custom template omitting `{author}` | Provide a template without the `{author}` placeholder. | The comment automatically prepends `@author` mention. |
| 9 | Custom template omitting `{threadList}` | Provide a template without the `{threadList}` placeholder. | The comment automatically appends a `**Unresolved automated review threads:**` heading and the thread list. |
| 10 | Custom template with `{author}`, `{unresolvedCount}`, and `{threadList}` | Provide a template containing all three placeholders. | All placeholders are substituted correctly, and the author mention/thread list are **not** duplicated. |
| 11 | Template with an unknown placeholder (e.g. `{foo}`) | Provide a template containing `{foo}`. | The unknown placeholder is left unchanged in the output (no error, no blank substitution). |

## 4. Input parameters and permissions scenarios

| # | Scenario | Steps | Expected result |
|---|----------|-------|------------------|
| 12 | `pr-number` omitted (relies on `github.event.pull_request.number`) | Trigger a standard `pull_request_review` event without setting the `pr-number` input. | The action resolves the PR number from the event payload and runs normally, or fails with a clear error if no fallback exists. |
| 13 | `token` uses default `github.token` with insufficient permissions | Remove `issues: write` or `pull-requests: write` from the workflow `permissions` block. | The action fails due to insufficient permissions, with a clear error message identifying the cause. |
| 14 | `all-approved` passed as a non-standard boolean string (e.g. empty string, `"True"`) | Set `all-approved` to unusual values and observe behavior. | The action treats these values consistently as truthy/falsy (document actual behavior if inconsistent). |

## 5. Repeated trigger / idempotency scenario

| # | Scenario | Steps | Expected result |
|---|----------|-------|------------------|
| 15 | Same PR triggers `pull_request_review` submitted multiple times (e.g. multiple reviewers approving sequentially) | Have several reviewers approve the same PR one after another, with unresolved bot threads present throughout. | Verify whether a duplicate notification comment is created for each approval event, or whether de-duplication exists. If no de-duplication exists, record this as a known limitation. |

## 6. Verification method

For each scenario above, manually check:

- Whether the expected comment was created on the PR (or correctly not created).
- The actual values of the three outputs (`has-unresolved`, `unresolved-count`,
  `thread-list`) in the Actions run.
- Whether the workflow run logs contain errors or warnings.

Record results using a table with columns: Scenario / Preconditions / Steps /
Expected Result / Actual Result, so the test plan can be re-run for future
regression testing. Use the blank template below to log results for each run:

| # | Scenario | Preconditions | Steps | Expected Result | Actual Result |
|---|----------|---------------|-------|------------------|---------------|
| 1 |          |               |       |                  |               |
| 2 |          |               |       |                  |               |
| 3 |          |               |       |                  |               |
| 4 |          |               |       |                  |               |
| 5 |          |               |       |                  |               |
| 6 |          |               |       |                  |               |
| 7 |          |               |       |                  |               |
| 8 |          |               |       |                  |               |
| 9 |          |               |       |                  |               |
| 10 |         |               |       |                  |               |
| 11 |         |               |       |                  |               |
| 12 |         |               |       |                  |               |
| 13 |         |               |       |                  |               |
| 14 |         |               |       |                  |               |
| 15 |         |               |       |                  |               |
