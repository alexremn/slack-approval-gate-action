import * as core from "@actions/core";

export interface Config {
  channelId: string;
  baseMessageTs: string | null;
  baseMessagePayload: Record<string, unknown>;
  approvers: string[];
  minimumApprovalCount: number;
  successMessagePayload: Record<string, unknown>;
  failMessagePayload: Record<string, unknown>;
  timeoutMs: number;
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
}

function parseJsonInput(name: string): Record<string, unknown> {
  const raw = core.getInput(name);
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Input ${name} is not valid JSON: ${(e as Error).message}`);
  }
}

function normalizeApprovers(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function loadConfig(): Config {
  const channelIdInput = core.getInput("channel-id").trim();
  const channelId = channelIdInput || process.env.SLACK_CHANNEL_ID || "";
  if (!channelId) {
    throw new Error("channel-id input or SLACK_CHANNEL_ID env required");
  }

  const slackBotToken = process.env.SLACK_BOT_TOKEN || "";
  const slackAppToken = process.env.SLACK_APP_TOKEN || "";
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || "";
  if (!slackBotToken) throw new Error("SLACK_BOT_TOKEN env required");
  if (!slackAppToken) throw new Error("SLACK_APP_TOKEN env required");

  const baseMessageTsRaw = core.getInput("base-message-ts").trim();
  const baseMessageTs = baseMessageTsRaw.length > 0 ? baseMessageTsRaw : null;

  const baseMessagePayload = parseJsonInput("base-message-payload");
  const successMessagePayload = parseJsonInput("success-message-payload");
  const failMessagePayload = parseJsonInput("fail-message-payload");

  if (baseMessageTs && Object.keys(baseMessagePayload).length > 0) {
    core.warning(
      "base-message-payload ignored: threaded mode active (base-message-ts set)",
    );
  }

  const approvers = normalizeApprovers(
    core.getInput("approvers", { required: true }),
  );
  if (approvers.length === 0) {
    throw new Error("approvers input must contain at least one user id");
  }

  const minimumRaw = core.getInput("minimum-approval-count").trim();
  const minimumApprovalCount = Number(minimumRaw) || 1;
  if (minimumApprovalCount > approvers.length) {
    throw new Error(
      `minimum-approval-count (${minimumApprovalCount}) exceeds approvers count (${approvers.length})`,
    );
  }

  const timeoutRaw = core.getInput("timeout-minutes").trim();
  const timeoutMinutes = Number(timeoutRaw) || 30;
  if (timeoutMinutes <= 0) {
    throw new Error("timeout-minutes must be > 0");
  }

  return {
    channelId,
    baseMessageTs,
    baseMessagePayload,
    approvers,
    minimumApprovalCount,
    successMessagePayload,
    failMessagePayload,
    timeoutMs: timeoutMinutes * 60_000,
    slackBotToken,
    slackAppToken,
    slackSigningSecret,
  };
}
