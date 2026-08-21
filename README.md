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
```

The action sets `has-unresolved`, `unresolved-count`, and `thread-list`
outputs. It only creates a comment when unresolved bot review threads are
found.