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

  test("follows pagination across more than two pages", async () => {
    const makePage = (login, typename, hasNextPage, endCursor) => ({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                isResolved: false,
                comments: {
                  nodes: [{ author: { login, __typename: typename }, body: "x", url: "url" }],
                },
              },
            ],
            pageInfo: { hasNextPage, endCursor },
          },
        },
      },
    });

    const client = {
      graphql: jest
        .fn()
        .mockResolvedValueOnce(makePage("Copilot", "Bot", true, "cursor-1"))
        .mockResolvedValueOnce(makePage("octocat", "User", true, "cursor-2"))
        .mockResolvedValueOnce(makePage("dependabot[bot]", "Bot", false, null)),
    };

    const threads = await findUnresolvedBotThreads(client, "owner", "repo", 1);

    expect(client.graphql).toHaveBeenCalledTimes(3);
    expect(client.graphql).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ after: "cursor-1" }),
    );
    expect(client.graphql).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      expect.objectContaining({ after: "cursor-2" }),
    );
    // Only the two bot-authored threads (pages 1 and 3) should be kept; the
    // human-authored thread on page 2 is filtered out.
    expect(threads).toHaveLength(2);
  });

  test("ignores threads with no comments", async () => {
    const client = {
      graphql: jest.fn().mockResolvedValueOnce({
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ isResolved: false, comments: { nodes: [] } }],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      }),
    };

    await expect(
      findUnresolvedBotThreads(client, "owner", "repo", 1),
    ).resolves.toHaveLength(0);
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

test("formatThreadList numbers multiple threads in order and preserves short bodies", () => {
  const threads = [
    { comments: { nodes: [{ body: "first issue", url: "https://example.test/1" }] } },
    { comments: { nodes: [{ body: "second issue", url: "https://example.test/2" }] } },
    { comments: { nodes: [{ body: "", url: "https://example.test/3" }] } },
  ];

  const list = formatThreadList(threads);

  expect(list).toBe(
    [
      "1. [View thread](https://example.test/1) - first issue",
      "2. [View thread](https://example.test/2) - second issue",
      "3. [View thread](https://example.test/3) - ",
    ].join("\n"),
  );
});

test("formatThreadList respects a custom previewLength", () => {
  const threads = [
    { comments: { nodes: [{ body: "abcdefghij", url: "https://example.test/1" }] } },
  ];

  const list = formatThreadList(threads, 5);

  expect(list).toBe("1. [View thread](https://example.test/1) - abcde...");
});
