import type { App } from "@slack/bolt";
import type { ApprovalState } from "./approval-state";
import type { SlackClient } from "./slack-client";
import {
  hasPayload,
  renderApprovalReply,
  renderFinalStatus,
  type ApprovalReplyState,
  type MessagePayload,
  type Outcome,
} from "./payloads";

export interface HandlersDeps {
  app: App;
  slack: SlackClient;
  state: ApprovalState;
  approvalMessageTs: string;
  approveActionId: string;
  rejectActionId: string;
  successPayload: MessagePayload;
  failPayload: MessagePayload;
  onTerminal: (outcome: Outcome, rejectedBy?: string) => Promise<void>;
}

function buildReplyState(
  state: ApprovalState,
  approveId: string,
  rejectId: string,
): ApprovalReplyState {
  return {
    minimumCount: state.minimumCount,
    remaining: state.getRemaining(),
    approved: state.getApprovers(),
    approveActionId: approveId,
    rejectActionId: rejectId,
  };
}

export function registerHandlers(deps: HandlersDeps): void {
  const {
    app,
    slack,
    state,
    approvalMessageTs,
    approveActionId,
    rejectActionId,
    successPayload,
    failPayload,
    onTerminal,
  } = deps;

  app.action("slack-approval-approve", async ({ ack, body, action, logger }) => {
    await ack();
    if (action.type !== "button" || (action as { type: string; value?: string }).value !== approveActionId) return;

    const userId = (body as { user: { id: string } }).user.id;

    try {
      const result = await state.tryApprove(userId);
      if (result === "not-authorized") {
        await slack.postEphemeral(
          userId,
          "You are not authorized to approve this request.",
          approvalMessageTs,
        );
        return;
      }
      if (result === "already-approved") {
        await slack.postEphemeral(
          userId,
          "You have already approved this request.",
          approvalMessageTs,
        );
        return;
      }
      if (result === "remaining") {
        await slack.updateApprovalReply(approvalMessageTs, {
          blocks: renderApprovalReply(
            buildReplyState(state, approveActionId, rejectActionId),
          ),
        });
        return;
      }
      // result === "approved"
      const finalPayload = hasPayload(successPayload)
        ? successPayload
        : { blocks: renderFinalStatus("approved", state.getApprovers()) };
      await slack.updateApprovalReply(approvalMessageTs, finalPayload);
      await onTerminal("approved");
    } catch (e) {
      logger.error(e as Error);
    }
  });

  app.action("slack-approval-reject", async ({ ack, body, action, logger }) => {
    await ack();
    if (action.type !== "button" || (action as { type: string; value?: string }).value !== rejectActionId) return;

    const userId = (body as { user: { id: string } }).user.id;
    try {
      const finalPayload = hasPayload(failPayload)
        ? failPayload
        : { blocks: renderFinalStatus("rejected", state.getApprovers(), userId) };
      await slack.updateApprovalReply(approvalMessageTs, finalPayload);
      await onTerminal("rejected", userId);
    } catch (e) {
      logger.error(e as Error);
    }
  });
}
