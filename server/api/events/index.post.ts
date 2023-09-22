import { Octokit } from "octokit";
import { OpenAI } from "openai";

export default defineEventHandler(async (event) => {
  const {
    githubToken,
    githubUserName,
    repositoryOwner,
    repositoryName,
    openAIToken,
  } = await readBody(event);

  const openAIModel = "gpt-3.5-turbo";
  const githubApiVersion = "2022-11-28";
  const octokit = new Octokit({ auth: githubToken });

  const events = (
    await octokit.request("GET /users/{username}/events", {
      username: githubUserName,
      headers: {
        "X-GitHub-Api-Version": githubApiVersion,
      },
    })
  ).data;

  const openai = new OpenAI({
    apiKey: openAIToken,
  });

  const pullRequestOnlyEvents = events.filter(
    (event) => event.type === "PullRequestEvent",
  );
  const pullRequestReducedData = [];

  for (const event of pullRequestOnlyEvents) {
    const prNumber = event.payload.pull_request.number;
    let prInfo = null;
    let reviews = null;

    if (prNumber) {
      prInfo = (
        await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner: repositoryOwner,
          repo: repositoryName,
          pull_number: prNumber,
          headers: {
            "X-GitHub-Api-Version": githubApiVersion,
          },
        })
      ).data;

      reviews = (
        await octokit.request(
          "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
          {
            owner: repositoryOwner,
            repo: repositoryName,
            pull_number: prNumber,
            headers: {
              "X-GitHub-Api-Version": githubApiVersion,
            },
          },
        )
      ).data;
    }

    pullRequestReducedData.push({
      id: event.id,
      type: event.type,
      created_at: event.created_at,
      repo: event.repo.name,
      actor: event.actor.login,
      pull_request: event.payload.pull_request
        ? {
            action: event.payload.action,
            number: prNumber,
            title: event.payload.pull_request.title,
            description: event.payload.pull_request.body,
            merged: event.payload.pull_request.merged,
            requested_reviewers: prInfo?.requested_reviewers?.map(
              (reviewer) => reviewer.login,
            ),
            reviews: reviews
              ?.map((review) => {
                return {
                  state: review.state,
                  user: review.user?.login,
                };
              })
              .filter(
                (review) =>
                  review.state === "APPROVED" ||
                  review.state === "CHANGES_REQUESTED",
              ),
          }
        : null,
    });
  }

  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You are web developer who is working on a project with a team of developers. You have to tell them what have you done since yesterday.",
      },
      {
        role: "user",
        content: `
            Here's what I've done since yesterday:
            ${JSON.stringify(pullRequestReducedData, null, 2)}
    
            Include all pull requests which were opened, closed or merged since yesterday.
            Add links to the pull requests number. 
            Rewrite pull request title, so it tells more about what was changed in few words, always create sentence. (prepared PR which fix cross-sell with extras)
            Do not include PR description.
            When the pull request is closed and merged say that it was merged.
            Add info about requested reviewers for opened pull requests. Every reviewer login has to be bold.
            Add info about reviews.
            Fix should have emoji 🩹 , feature should have 🚀, chore should have 🏡.
            Merged PR should have ✅.
            Put requested reviewers info on the new line.
            Format the message using markdown. Separate the events with new line.
            
            There is a example of the message:
                - prepared PR which fix cross-sell with extras [#803](https://github.com/owner/repository/issues/803) 🩹
                    - ready for review / test by @sebastian
                    - already approved by @MatejLesko
                - opened PR which adds support for pickup time ranges [#549](https://github.com/owner/repository/issues/549) 🚀
                    - ready for review / test
                - reverted the release from productions - the canceling orders bug, prepared PR with fix 
                    - everything merged (I saw that the release is in production without issue)
           `,
      },
    ],
    model: openAIModel,
  });

  return {
    pullRequestReducedData,
    chatResponse: completion,
  };
});
