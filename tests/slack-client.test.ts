import { SlackClient } from "../src/slack-client";

function makeWeb() {
  return {
    chat: {
      postMessage: jest.fn(),
      update: jest.fn(),
      postEphemeral: jest.fn(),
    },
  };
}

describe("SlackClient", () => {
  it("postMain sends payload and returns ts", async () => {
    const web = makeWeb();
    web.chat.postMessage.mockResolvedValue({ ts: "1.0" });
    const client = new SlackClient(web as any, "C1");
    const ts = await client.postMain({ text: "hi" });
    expect(ts).toBe("1.0");
    expect(web.chat.postMessage).toHaveBeenCalledWith({ channel: "C1", text: "hi" });
  });

  it("postMain throws when ts is missing", async () => {
    const web = makeWeb();
    web.chat.postMessage.mockResolvedValue({});
    const client = new SlackClient(web as any, "C1");
    await expect(client.postMain({ text: "hi" })).rejects.toThrow(/no ts/);
  });

  it("postApprovalReply posts with thread_ts and returns ts", async () => {
    const web = makeWeb();
    web.chat.postMessage.mockResolvedValue({ ts: "2.0" });
    const client = new SlackClient(web as any, "C1");
    const ts = await client.postApprovalReply("1.0", [{ type: "section" }]);
    expect(ts).toBe("2.0");
    expect(web.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C1",
        thread_ts: "1.0",
        blocks: [{ type: "section" }],
      }),
    );
  });

  it("updateApprovalReply targets ts and channel", async () => {
    const web = makeWeb();
    web.chat.update.mockResolvedValue({ ok: true });
    const client = new SlackClient(web as any, "C1");
    await client.updateApprovalReply("2.0", { blocks: [{ type: "section" }] });
    expect(web.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C1",
        ts: "2.0",
        blocks: [{ type: "section" }],
      }),
    );
  });

  it("updateApprovalReply passes empty blocks array when blocks undefined", async () => {
    const web = makeWeb();
    web.chat.update.mockResolvedValue({ ok: true });
    const client = new SlackClient(web as any, "C1");
    await client.updateApprovalReply("2.0", { text: "hi" });
    expect(web.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C1", ts: "2.0", text: "hi", blocks: [] }),
    );
  });

  it("postEphemeral targets user", async () => {
    const web = makeWeb();
    web.chat.postEphemeral.mockResolvedValue({ ok: true });
    const client = new SlackClient(web as any, "C1");
    await client.postEphemeral("U1", "nope", "2.0");
    expect(web.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C1",
        user: "U1",
        text: "nope",
        thread_ts: "2.0",
      }),
    );
  });
});
