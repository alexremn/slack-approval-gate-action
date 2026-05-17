import * as core from "@actions/core";
import { App, LogLevel } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { loadConfig } from "./config";
import {
  defaultMainPayload,
  hasPayload,
  readGithubContext,
  renderApprovalReply,
  renderFinalStatus,
  type MessagePayload,
  type Outcome,
} from "./payloads";
import { ApprovalState } from "./approval-state";
import { SlackClient } from "./slack-client";
import { mintActionId } from "./action-id";
import { registerHandlers } from "./handlers";

async function main(): Promise<void> {
  const config = loadConfig();
  const ghCtx = readGithubContext();
  const aidSeed = `${ghCtx.repo}-${ghCtx.workflow}-${ghCtx.runId}-${ghCtx.runNumber}-${ghCtx.runAttempt}`;
  const approveActionId = mintActionId(`approve:${aidSeed}`);
  const rejectActionId = mintActionId(`reject:${aidSeed}`);

  const web = new WebClient(config.slackBotToken);
  const slack = new SlackClient(web, config.channelId);

  let mainMessageTs: string;
  if (config.baseMessageTs) {
    mainMessageTs = config.baseMessageTs;
  } else {
    const payload = hasPayload(config.baseMessagePayload)
      ? config.baseMessagePayload
      : (defaultMainPayload(ghCtx) as Record<string, unknown>);
    mainMessageTs = await slack.postMain(payload);
  }

  const state = new ApprovalState(config.approvers, config.minimumApprovalCount);
  const initialBlocks = renderApprovalReply({
    minimumCount: state.minimumCount,
    remaining: state.getRemaining(),
    approved: state.getApprovers(),
    approveActionId,
    rejectActionId,
  });
  const approvalMessageTs = await slack.postApprovalReply(
    mainMessageTs,
    initialBlocks,
  );

  core.setOutput("main-message-ts", mainMessageTs);
  core.setOutput("approval-message-ts", approvalMessageTs);

  const app = new App({
    token: config.slackBotToken,
    signingSecret: config.slackSigningSecret || undefined,
    appToken: config.slackAppToken,
    socketMode: true,
    logLevel: LogLevel.INFO,
  });

  let shuttingDown = false;
  const shutdown = async (
    outcome: Outcome,
    code: number,
  ): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    core.setOutput("result", outcome);
    core.setOutput("approvers-json", JSON.stringify(state.getApprovers()));
    try {
      await app.stop();
    } catch (e) {
      core.warning(`Bolt stop failed: ${(e as Error).message}`);
    }
    process.exit(code);
  };

  registerHandlers({
    app,
    slack,
    state,
    approvalMessageTs,
    approveActionId,
    rejectActionId,
    successPayload: config.successMessagePayload as MessagePayload,
    failPayload: config.failMessagePayload as MessagePayload,
    onTerminal: async (outcome) => {
      const code = outcome === "approved" ? 0 : 1;
      await shutdown(outcome, code);
    },
  });

  const onCancel = async (): Promise<void> => {
    if (shuttingDown) return;
    try {
      const payload = hasPayload(config.failMessagePayload)
        ? (config.failMessagePayload as MessagePayload)
        : { blocks: renderFinalStatus("canceled", state.getApprovers()) };
      await slack.updateApprovalReply(approvalMessageTs, payload);
    } catch (e) {
      core.warning(`Cancel update failed: ${(e as Error).message}`);
    }
    await shutdown("canceled", 1);
  };
  process.on("SIGTERM", onCancel);
  process.on("SIGINT", onCancel);
  process.on("SIGBREAK" as NodeJS.Signals, onCancel);

  const timeoutHandle = setTimeout(async () => {
    if (shuttingDown) return;
    try {
      const payload = hasPayload(config.failMessagePayload)
        ? (config.failMessagePayload as MessagePayload)
        : { blocks: renderFinalStatus("timed-out", state.getApprovers()) };
      await slack.updateApprovalReply(approvalMessageTs, payload);
    } catch (e) {
      core.warning(`Timeout update failed: ${(e as Error).message}`);
    }
    await shutdown("timed-out", 1);
  }, config.timeoutMs);
  timeoutHandle.unref?.();

  await app.start();
  core.info("Waiting for approval...");
}

main().catch((e: Error) => {
  core.setFailed(e.message);
  process.exit(1);
});
