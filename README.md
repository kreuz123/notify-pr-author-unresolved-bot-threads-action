# notify-pr-author-unresolved-copilot-threads-action

Notifies the pull request author when all requested human reviewers have
approved but unresolved Copilot review threads remain.

The approval check is intentionally delegated to the independent
[`check-all-reviewers-approved-action`](https://github.com/kreuz123/check-all-reviewers-approved-action)
action.

## Usage

```yaml
name: Notify PR author of unresolved Copilot threads

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

      - name: Notify about unresolved Copilot threads
        uses: kreuz123/notify-pr-author-unresolved-copilot-threads-action@v1
        with:
          pr-number: ${{ github.event.pull_request.number }}
          all-approved: ${{ steps.approval.outputs.all-approved }}
```

The action sets `has-unresolved`, `unresolved-count`, and `thread-list`
outputs. It only creates a comment when unresolved Copilot threads are found.