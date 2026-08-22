# notify-pr-author-unresolved-bot-threads-action

Notifies the pull request author when all requested human reviewers have
approved but unresolved review threads started by an automated reviewer
(such as Copilot code review, or any other bot/App-based review integration)
remain.

Thread authors are identified using GitHub's GraphQL `Actor.__typename`
field: any comment authored by an account of type `Bot` is treated as an
automated reviewer comment, regardless of its login name. This means the
action automatically covers Copilot and any other bot review tool you add in
the future, without needing to maintain a list of known bot logins.

The approval check is intentionally delegated to the independent
[`check-all-reviewers-approved-action`](https://github.com/kreuz123/check-all-reviewers-approved-action)
action.

## Usage

```yaml
name: Notify PR author of unresolved automated review threads

on:
  pull_request_review:
    types: [submitted]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  notify:
    if: ${{ github.event.review.state == 'APPROVED' }}
    runs-on: ubuntu-latest
    steps:
      - name: Check approval status
        id: approval
        uses: kreuz123/check-all-reviewers-approved-action@v1
        with:
          pr-number: ${{ github.event.pull_request.number }}

      - name: Notify about unresolved automated review threads
        uses: kreuz123/notify-pr-author-unresolved-bot-threads-action@v1
        with:
          pr-number: ${{ github.event.pull_request.number }}
          all-approved: ${{ steps.approval.outputs.all-approved }}
          comment-template: |
            Hey {author}! There are {unresolvedCount} unresolved automated review thread(s) left:
            {threadList}
```

The action sets `has-unresolved`, `unresolved-count`, and `thread-list`
outputs. It only creates a comment when unresolved bot review threads are
found.

### Customizing the comment

The `comment-template` input lets you customize the notification comment.
It supports the following placeholders:

- `{author}` - mentions the PR author (rendered as `@login`). If omitted
  from the template, the mention is automatically prepended to the comment.
- `{unresolvedCount}` - the number of unresolved automated review threads.
- `{threadList}` - the formatted markdown list of unresolved threads. If
  omitted from the template, the thread list is automatically appended
  under a `**Unresolved automated review threads:**` heading.

If `comment-template` is not provided, it defaults to:

```
All reviewers have approved this PR! 🎉

However, there are {unresolvedCount} unresolved review thread(s) started by an automated reviewer (e.g. Copilot) that need your attention. Please resolve these conversations.

**Unresolved automated review threads:**

{threadList}
```

## Manual testing

See [MANUAL_TESTING.md](MANUAL_TESTING.md) for a manual test plan covering
end-to-end scenarios in a real GitHub repository.