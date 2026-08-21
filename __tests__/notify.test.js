const {
  findUnresolvedBotThreads,
  formatThreadList,
  isBotComment,
} = require("../src/notify");

describe("isBotComment", () => {
  test.each(["Copilot", "dependabot[bot]", "sonarqubecloud[bot]"])(
    "recognizes %s as a bot when __typename is Bot",
    (login) =>
      expect(isBotComment({ author: { login, __typename: "Bot" } })).toBe(true),
  );

  test("rejects human comments even if the login looks bot-like", () => {
    expect(
      isBotComment({ author: { login: "copilot-fan", __typename: "User" } }),
    ).toBe(false);
  });

  test("rejects comments with no author", () => {
    expect(isBotComment({ author: null })).toBe(false);
  });
});

describe("findUnresolvedBotThreads", () => {
  test("filters unresolved bot threads across pages", async () => {
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
                      nodes: [
                        {
                          author: { login: "Copilot", __typename: "Bot" },
                          body: "fix",
                          url: "url",
                        },
                      ],
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
                      nodes: [
                        {
                          author: { login: "Copilot", __typename: "Bot" },
                          body: "done",
                          url: "url",
                        },
                      ],
                    },
                  },
                  {
                    isResolved: false,
                    comments: {
                      nodes: [
                        {
                          author: { login: "octocat", __typename: "User" },
                          body: "human comment",
                          url: "url",
                        },
                      ],
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
    };

    await expect(findUnresolvedBotThreads(client, "owner", "repo", 1)).resolves.toHaveLength(1);
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
