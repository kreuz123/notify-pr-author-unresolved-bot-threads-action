const REVIEW_THREADS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $after) {
          nodes {
            isResolved
            comments(first: 1) {
              nodes {
                author { login }
                body
                url
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

function isCopilotComment(comment) {
  const login = comment?.author?.login;
  return Boolean(
    login &&
      (login === "Copilot" ||
        login.toLowerCase().includes("copilot") ||
        login === "github-actions[bot]"),
  );
}

async function findUnresolvedCopilotThreads(client, owner, repo, prNumber) {
  const threads = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await client.graphql(REVIEW_THREADS_QUERY, {
      owner,
      repo,
      number: prNumber,
      after,
    });
    const reviewThreads = result.repository.pullRequest.reviewThreads;
    threads.push(
      ...reviewThreads.nodes.filter(
        (thread) =>
          !thread.isResolved &&
          thread.comments.nodes.length > 0 &&
          isCopilotComment(thread.comments.nodes[0]),
      ),
    );
    hasNextPage = reviewThreads.pageInfo.hasNextPage;
    after = reviewThreads.pageInfo.endCursor;
  }

  return threads;
}

function formatThreadList(threads, previewLength = 70) {
  return threads
    .map((thread, index) => {
      const comment = thread.comments.nodes[0];
      const body = comment.body || "";
      const preview = body.substring(0, previewLength).replace(/\n/g, " ");
      return `${index + 1}. [View thread](${comment.url}) - ${preview}${body.length > previewLength ? "..." : ""}`;
    })
    .join("\n");
}

module.exports = { findUnresolvedCopilotThreads, formatThreadList, isCopilotComment };
