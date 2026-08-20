const {
  findUnresolvedCopilotThreads,
  formatThreadList,
  isCopilotComment,
} = require("../src/notify");

describe("isCopilotComment", () => {
  test.each(["Copilot", "copilot[bot]", "github-actions[bot]"])(
    "recognizes %s",
    (login) => expect(isCopilotComment({ author: { login } })).toBe(true),
  );

  test("rejects human comments", () => {
    expect(isCopilotComment({ author: { login: "octocat" } })).toBe(false);
  });
});

describe("findUnresolvedCopilotThreads", () => {
  test("filters unresolved Copilot threads across pages", async () => {
    const client = {
      graphql: jest
        .fn()
        .mockResolvedValueOnce({
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    isResolved: false,
                    comments: {
                      nodes: [{ author: { login: "Copilot" }, body: "fix", url: "url" }],
                    },
                  },
                ],
                pageInfo: { hasNextPage: true, endCursor: "cursor" },
              },
            },
          },
        })
        .mockResolvedValueOnce({
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    isResolved: true,
                    comments: {
                      nodes: [{ author: { login: "Copilot" }, body: "done", url: "url" }],
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
    };

    await expect(findUnresolvedCopilotThreads(client, "owner", "repo", 1)).resolves.toHaveLength(1);
    expect(client.graphql).toHaveBeenCalledTimes(2);
  });
});

test("formatThreadList truncates previews and flattens newlines", () => {
  const list = formatThreadList([
    {
      comments: {
        nodes: [{ body: `${"a".repeat(71)}\nnext`, url: "https://example.test/thread" }],
      },
    },
  ]);

  expect(list).toBe(`1. [View thread](https://example.test/thread) - ${"a".repeat(70)}...`);
});
