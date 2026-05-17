import type { WebClient } from "@slack/web-api";
import type { KnownBlock } from "@slack/types";

export interface UpdatePayload {
  text?: string;
  blocks?: unknown[];
}

export class SlackClient {
  constructor(private readonly web: WebClient, private readonly channel: string) {}

  async postMain(payload: Record<string, unknown>): Promise<string> {
    const res = await this.web.chat.postMessage({
      channel: this.channel,
      ...(payload as object),
    } as Parameters<WebClient["chat"]["postMessage"]>[0]);
    if (!res.ts) throw new Error("Slack chat.postMessage returned no ts");
    return res.ts;
  }

  async postApprovalReply(threadTs: string, blocks: unknown[]): Promise<string> {
    const res = await this.web.chat.postMessage({
      channel: this.channel,
      thread_ts: threadTs,
      text: "Approval request",
      blocks: blocks as unknown as KnownBlock[],
    });
    if (!res.ts) throw new Error("Slack chat.postMessage returned no ts");
    return res.ts;
  }

  async updateApprovalReply(ts: string, payload: UpdatePayload): Promise<void> {
    await this.web.chat.update({
      channel: this.channel,
      ts,
      text: payload.text ?? "Approval status",
      blocks: (payload.blocks ?? []) as unknown as KnownBlock[],
    });
  }

  async postEphemeral(user: string, text: string, threadTs?: string): Promise<void> {
    await this.web.chat.postEphemeral({
      channel: this.channel,
      user,
      text,
      thread_ts: threadTs,
    });
  }
}
