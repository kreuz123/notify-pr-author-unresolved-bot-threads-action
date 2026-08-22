jest.mock("@actions/core", () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
}));
jest.mock("@actions/github", () => ({
  getOctokit: jest.fn(),
  context: {},
}));
jest.mock("../src/notify");

const core = require("@actions/core");
const github = require("@actions/github");
const { findUnresolvedBotThreads, formatThreadList } = require("../src/notify");
const { run } = require("../index");

const DEFAULT_COMMENT_TEMPLATE =
  "All reviewers have approved this PR! 🎉\n\nHowever, there are {unresolvedCount} unresolved review thread(s) started by an automated reviewer (e.g. Copilot) that need your attention. Please resolve these conversations.\n\n**Unresolved automated review threads:**\n\n{threadList}";


describe("run", () => {
  let createComment;

  beforeEach(() => {
    jest.clearAllMocks();

    createComment = jest.fn().mockResolvedValue({});
    github.getOctokit = jest.fn().mockReturnValue({
      rest: { issues: { createComment } },
    });
    github.context = {
      repo: { owner: "owner", repo: "repo" },
      payload: { pull_request: { user: { login: "author" } } },
    };

    const inputs = {
      "all-approved": "true",
      "pr-number": "1",
      token: "token",
      "comment-template": DEFAULT_COMMENT_TEMPLATE,
    };
    core.getInput = jest.fn((name) => inputs[name] ?? "");
    core.setOutput = jest.fn();
    core.setFailed = jest.fn();

    findUnresolvedBotThreads.mockResolvedValue([]);
    formatThreadList.mockReturnValue("");
  });

  test("returns early when all-approved is not true", async () => {
    core.getInput = jest.fn((name) =>
      name === "all-approved" ? "false" : "",
    );

    await run();

    expect(core.setOutput).toHaveBeenCalledWith("has-unresolved", "false");
    expect(core.setOutput).toHaveBeenCalledWith("unresolved-count", "0");
    expect(core.setOutput).toHaveBeenCalledWith("thread-list", "");
    expect(github.getOctokit).not.toHaveBeenCalled();
    expect(findUnresolvedBotThreads).not.toHaveBeenCalled();
  });

  test.each(["True", "TRUE", "tRuE"])(
    "treats all-approved value %s as approved (case-insensitive)",
    async (allApproved) => {
      const inputs = {
        "all-approved": allApproved,
        "pr-number": "1",
        token: "token",
        "comment-template": DEFAULT_COMMENT_TEMPLATE,
      };
      core.getInput = jest.fn((name) => inputs[name] ?? "");

      await run();

      expect(github.getOctokit).toHaveBeenCalled();
      expect(findUnresolvedBotThreads).toHaveBeenCalled();
      expect(core.setOutput).toHaveBeenCalledWith("has-unresolved", "false");
      expect(core.setOutput).toHaveBeenCalledWith("unresolved-count", "0");
    },
  );

  test.each(["", "false", "no", "0"])(
    "treats all-approved value %j as not approved",
    async (allApproved) => {
      const inputs = { "all-approved": allApproved, "pr-number": "1", token: "token" };
      core.getInput = jest.fn((name) => inputs[name] ?? "");

      await run();

      expect(core.setOutput).toHaveBeenCalledWith("has-unresolved", "false");
      expect(core.setOutput).toHaveBeenCalledWith("unresolved-count", "0");
      expect(core.setOutput).toHaveBeenCalledWith("thread-list", "");
      expect(github.getOctokit).not.toHaveBeenCalled();
      expect(findUnresolvedBotThreads).not.toHaveBeenCalled();
    },
  );

  test.each(["0", "-1", "abc", "1.5", " ", "3.0"])(
    "setFailed when pr-number is invalid: %s",
    async (prNumber) => {
      const inputs = { "all-approved": "true", "pr-number": prNumber, token: "token" };
      core.getInput = jest.fn((name) => inputs[name] ?? "");

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining(`Input "pr-number" must be a positive integer`),
      );
      expect(github.getOctokit).not.toHaveBeenCalled();
    },
  );

  test("throws when PR author cannot be determined", async () => {
    github.context.payload = { pull_request: { user: null } };
    findUnresolvedBotThreads.mockResolvedValue([
      { comments: { nodes: [{ body: "issue", url: "url" }] } },
    ]);
    formatThreadList.mockReturnValue("1. [View thread](url) - issue");

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      "Action failed: Pull request author could not be determined from the event payload.",
    );
    expect(createComment).not.toHaveBeenCalled();
  });

  test("creates a comment when unresolved threads exist", async () => {
    const threads = [
      { comments: { nodes: [{ body: "issue", url: "url" }] } },
    ];
    findUnresolvedBotThreads.mockResolvedValue(threads);
    formatThreadList.mockReturnValue("1. [View thread](url) - issue");

    await run();

    expect(findUnresolvedBotThreads).toHaveBeenCalledWith(
      expect.anything(),
      "owner",
      "repo",
      1,
    );
    expect(core.setOutput).toHaveBeenCalledWith("has-unresolved", "true");
    expect(core.setOutput).toHaveBeenCalledWith("unresolved-count", "1");
    expect(core.setOutput).toHaveBeenCalledWith(
      "thread-list",
      "1. [View thread](url) - issue",
    );
    expect(createComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 1,
      body: expect.stringContaining("@author All reviewers have approved this PR!"),
    });
    expect(createComment.mock.calls[0][0].body).toContain(
      "1. [View thread](url) - issue",
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  test("uses a custom comment-template input when provided", async () => {
    const inputs = {
      "all-approved": "true",
      "pr-number": "1",
      token: "token",
      "comment-template": "Hi {author}, please resolve {unresolvedCount} thread(s):\n{threadList}",
    };
    core.getInput = jest.fn((name) => inputs[name] ?? "");

    const threads = [
      { comments: { nodes: [{ body: "issue", url: "url" }] } },
    ];
    findUnresolvedBotThreads.mockResolvedValue(threads);
    formatThreadList.mockReturnValue("1. [View thread](url) - issue");

    await run();

    expect(createComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 1,
      body: "Hi @author, please resolve 1 thread(s):\n1. [View thread](url) - issue",
    });
  });

  test("does not create a comment when there are no unresolved threads", async () => {
    findUnresolvedBotThreads.mockResolvedValue([]);
    formatThreadList.mockReturnValue("");

    await run();

    expect(core.setOutput).toHaveBeenCalledWith("has-unresolved", "false");
    expect(core.setOutput).toHaveBeenCalledWith("unresolved-count", "0");
    expect(createComment).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });
});
