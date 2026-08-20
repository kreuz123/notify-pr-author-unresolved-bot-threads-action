const core = require("@actions/core");
const github = require("@actions/github");
const {
  findUnresolvedCopilotThreads,
  formatThreadList,
} = require("./src/notify");

async function run() {
  try {
    if (core.getInput("all-approved").toLowerCase() !== "true") {
      core.setOutput("has-unresolved", "false");
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
    const threads = await findUnresolvedCopilotThreads(client, owner, repo, prNumber);
    const threadList = formatThreadList(threads);
    const count = threads.length.toString();

    core.setOutput("has-unresolved", (threads.length > 0).toString());
    core.setOutput("unresolved-count", count);
    core.setOutput("thread-list", threadList);

    if (threads.length === 0) return;

    const prAuthor = github.context.payload.pull_request?.user?.login;
    if (!prAuthor) throw new Error("Pull request author could not be determined from the event payload.");

    await client.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `@${prAuthor} All reviewers have approved this PR! 🎉\n\n` +
        `However, there are ${count} unresolved Copilot review thread(s) that need your attention. Please resolve these conversations.\n\n` +
        `**Unresolved Copilot threads:**\n\n${threadList}`,
    });
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

module.exports = { run };

if (require.main === module) run();
