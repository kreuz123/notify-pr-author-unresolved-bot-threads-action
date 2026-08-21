const core = require("@actions/core");
const github = require("@actions/github");
const {
  findUnresolvedBotThreads,
  formatThreadList,
} = require("./src/notify");
const { buildCommentBody } = require("./src/build-comment");

async function run() {
  try {
    if (core.getInput("all-approved").toLowerCase() !== "true") {
      core.setOutput("has-unresolved", "false");
      core.setOutput("unresolved-count", "0");
      core.setOutput("thread-list", "");
      return;
    }

    const prNumberInput = core.getInput("pr-number").trim();
    const prNumber = Number(prNumberInput);
    if (!/^\d+$/.test(prNumberInput) || !Number.isSafeInteger(prNumber) || prNumber <= 0) {
      core.setFailed(`Input "pr-number" must be a positive integer. Received: "${prNumberInput}"`);
      return;
    }

    const token = core.getInput("token");
    const client = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const threads = await findUnresolvedBotThreads(client, owner, repo, prNumber);
    const threadList = formatThreadList(threads);
    const count = threads.length.toString();

    core.setOutput("has-unresolved", (threads.length > 0).toString());
    core.setOutput("unresolved-count", count);
    core.setOutput("thread-list", threadList);

    if (threads.length === 0) return;

    const prAuthor = github.context.payload.pull_request?.user?.login;
    if (!prAuthor) throw new Error("Pull request author could not be determined from the event payload.");

    const commentTemplate = core.getInput("comment-template", { trimWhitespace: false });
    const commentBody = buildCommentBody(commentTemplate, {
      author: prAuthor,
      unresolvedCount: count,
      threadList,
    });

    await client.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

module.exports = { run };

if (require.main === module) run();
