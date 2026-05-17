export interface MessagePayload {
  text?: string;
  blocks?: unknown[];
}

export function hasPayload(p: MessagePayload | Record<string, unknown> | undefined): boolean {
  if (!p) return false;
  const text = (p as MessagePayload).text;
  const blocks = (p as MessagePayload).blocks;
  if (typeof text === "string" && text.length > 0) return true;
  if (Array.isArray(blocks) && blocks.length > 0) return true;
  return false;
}

export interface GithubContext {
  serverUrl: string;
  repo: string;
  runId: string;
  runNumber: string;
  runAttempt: string;
  workflow: string;
  runnerOs: string;
  actor: string;
}

export function readGithubContext(): GithubContext {
  return {
    serverUrl: process.env.GITHUB_SERVER_URL || "",
    repo: process.env.GITHUB_REPOSITORY || "",
    runId: process.env.GITHUB_RUN_ID || "",
    runNumber: process.env.GITHUB_RUN_NUMBER || "",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || "",
    workflow: process.env.GITHUB_WORKFLOW || "",
    runnerOs: process.env.RUNNER_OS || "",
    actor: process.env.GITHUB_ACTOR || "",
  };
}

export function defaultMainPayload(ctx: GithubContext): MessagePayload {
  const actionsUrl = `${ctx.serverUrl}/${ctx.repo}/actions/runs/${ctx.runId}`;
  return {
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: "GitHub Actions Approval Request" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*GitHub Actor:*\n${ctx.actor}` },
          { type: "mrkdwn", text: `*Repos:*\n${ctx.serverUrl}/${ctx.repo}` },
          { type: "mrkdwn", text: `*Actions URL:*\n${actionsUrl}` },
          { type: "mrkdwn", text: `*GITHUB_RUN_ID:*\n${ctx.runId}` },
          { type: "mrkdwn", text: `*Workflow:*\n${ctx.workflow}` },
          { type: "mrkdwn", text: `*RunnerOS:*\n${ctx.runnerOs}` },
        ],
      },
    ],
  };
}

export interface ApprovalReplyState {
  minimumCount: number;
  remaining: string[];
  approved: string[];
  approveActionId: string;
  rejectActionId: string;
}

export function renderApprovalReply(state: ApprovalReplyState): unknown[] {
  const remainingText =
    state.remaining.length > 0
      ? state.remaining.map(v => `<@${v}>`).join(", ")
      : "(none)";
  const approvedLine =
    state.approved.length > 0
      ? `Approvers: ${state.approved.map(v => `<@${v}>`).join(", ")}\n`
      : "\n";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Required Approvers Count:* ${state.minimumCount}\n` +
          `*Remaining Approvers:* ${remainingText}\n` +
          approvedLine,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", emoji: true, text: "approve" },
          style: "primary",
          value: state.approveActionId,
          action_id: "slack-approval-approve",
        },
        {
          type: "button",
          text: { type: "plain_text", emoji: true, text: "reject" },
          style: "danger",
          value: state.rejectActionId,
          action_id: "slack-approval-reject",
        },
      ],
    },
  ];
}

export type Outcome = "approved" | "rejected" | "canceled" | "timed-out";

export function renderFinalStatus(
  outcome: Outcome,
  approvers: string[],
  rejectedBy?: string,
): unknown[] {
  let text: string;
  switch (outcome) {
    case "approved":
      text =
        `Approved :white_check_mark:` +
        (approvers.length > 0
          ? ` by ${approvers.map(v => `<@${v}>`).join(", ")}`
          : "");
      break;
    case "rejected":
      text = `Rejected${rejectedBy ? ` by <@${rejectedBy}>` : ""} :x:`;
      break;
    case "canceled":
      text = "Canceled :radio_button: :leftwards_arrow_with_hook:";
      break;
    case "timed-out":
      text = "Timed out :hourglass:";
      break;
  }
  return [{ type: "section", text: { type: "mrkdwn", text } }];
}
