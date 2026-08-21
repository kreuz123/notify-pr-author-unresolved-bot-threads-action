const { buildCommentBody } = require("../src/build-comment");

const DEFAULT_TEMPLATE =
  "All reviewers have approved this PR! 🎉\n\nHowever, there are {unresolvedCount} unresolved review thread(s) started by an automated reviewer (e.g. Copilot) that need your attention. Please resolve these conversations.\n\n**Unresolved automated review threads:**\n\n{threadList}";

describe("buildCommentBody", () => {
  test("renders the default template", () => {
    const result = buildCommentBody(DEFAULT_TEMPLATE, {
      author: "octocat",
      unresolvedCount: 2,
      threadList: "1. [View thread](url)",
    });

    expect(result).toBe(
      "@octocat All reviewers have approved this PR! 🎉\n\nHowever, there are 2 unresolved review thread(s) started by an automated reviewer (e.g. Copilot) that need your attention. Please resolve these conversations.\n\n**Unresolved automated review threads:**\n\n1. [View thread](url)",
    );
  });

  test("substitutes placeholders in a custom template", () => {
    const template = "Hey! {unresolvedCount} thread(s) still open:\n{threadList}";

    const result = buildCommentBody(template, {
      author: "octocat",
      unresolvedCount: 3,
      threadList: "1. [View thread](url)",
    });

    expect(result).toBe(
      "@octocat Hey! 3 thread(s) still open:\n1. [View thread](url)",
    );
  });

  test("appends the thread list section when {threadList} is not present in the template", () => {
    const template = "{unresolvedCount} unresolved thread(s) found.";

    const result = buildCommentBody(template, {
      author: "octocat",
      unresolvedCount: 1,
      threadList: "1. [View thread](url)",
    });

    expect(result).toBe(
      "@octocat 1 unresolved thread(s) found.\n\n**Unresolved automated review threads:**\n\n1. [View thread](url)",
    );
  });

  test("does not duplicate the thread list when {threadList} is present in the template", () => {
    const template = "Threads: {threadList}";

    const result = buildCommentBody(template, {
      author: "octocat",
      unresolvedCount: 1,
      threadList: "1. [View thread](url)",
    });

    expect(result.match(/View thread/g)).toHaveLength(1);
  });

  test("renders {author} as a mention and does not duplicate it", () => {
    const template = "Please resolve your threads, {author}.";

    const result = buildCommentBody(template, {
      author: "octocat",
      unresolvedCount: 1,
      threadList: "1. [View thread](url)",
    });

    expect(result).toContain("Please resolve your threads, @octocat.");
    expect(result.match(/@octocat/g)).toHaveLength(1);
    expect(result).toContain(
      "**Unresolved automated review threads:**\n\n1. [View thread](url)",
    );
  });

  test("handles zero unresolved threads", () => {
    const template = "{unresolvedCount} unresolved thread(s) found.";

    const result = buildCommentBody(template, {
      author: "octocat",
      unresolvedCount: 0,
      threadList: "",
    });

    expect(result).toBe(
      "@octocat 0 unresolved thread(s) found.\n\n**Unresolved automated review threads:**\n\n",
    );
  });

  test("leaves unknown placeholders untouched", () => {
    const template = "Hello {unknown}, {unresolvedCount} thread(s).";

    const result = buildCommentBody(template, {
      author: "octocat",
      unresolvedCount: 1,
      threadList: "x",
    });

    expect(result).toContain("Hello {unknown}, 1 thread(s).");
  });
});
