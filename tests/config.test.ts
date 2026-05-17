import { loadConfig } from "../src/config";

const INPUT_PREFIX = "INPUT_";

function setInput(name: string, value: string): void {
  process.env[`${INPUT_PREFIX}${name.toUpperCase()}`] = value;
}

function clearInputs(): void {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith(INPUT_PREFIX)) delete process.env[k];
  }
}

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearInputs();
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_APP_TOKEN = "xapp-test";
    process.env.SLACK_SIGNING_SECRET = "secret";
    process.env.SLACK_CHANNEL_ID = "C123";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("loads minimal valid config", () => {
    setInput("approvers", "u1,u2");
    const c = loadConfig();
    expect(c.approvers).toEqual(["u1", "u2"]);
    expect(c.minimumApprovalCount).toBe(1);
    expect(c.baseMessageTs).toBeNull();
    expect(c.channelId).toBe("C123");
    expect(c.timeoutMs).toBe(30 * 60_000);
  });

  it("uses channel-id input over env", () => {
    setInput("approvers", "u1");
    setInput("channel-id", "C999");
    expect(loadConfig().channelId).toBe("C999");
  });

  it("normalizes approvers (trim, dedupe, drop empty)", () => {
    setInput("approvers", " u1 , u2,, u1 ,u3 ");
    expect(loadConfig().approvers).toEqual(["u1", "u2", "u3"]);
  });

  it("throws when approvers list is empty after normalization", () => {
    setInput("approvers", " , , ");
    expect(() => loadConfig()).toThrow(/approvers/);
  });

  it("throws when minimum-approval-count exceeds approvers length", () => {
    setInput("approvers", "u1");
    setInput("minimum-approval-count", "2");
    expect(() => loadConfig()).toThrow(/exceeds approvers count/);
  });

  it("treats 0 minimum-approval-count as default 1", () => {
    setInput("approvers", "u1");
    setInput("minimum-approval-count", "0");
    expect(loadConfig().minimumApprovalCount).toBe(1);
  });

  it("parses multiline JSON payloads correctly", () => {
    setInput("approvers", "u1");
    setInput(
      "base-message-payload",
      '{\n  "text": "hello\\nworld",\n  "blocks": []\n}',
    );
    const c = loadConfig();
    expect(c.baseMessagePayload).toEqual({ text: "hello\nworld", blocks: [] });
  });

  it("throws on invalid JSON payload", () => {
    setInput("approvers", "u1");
    setInput("base-message-payload", "{not json");
    expect(() => loadConfig()).toThrow(/base-message-payload.*not valid JSON/);
  });

  it("treats base-message-ts as enabling threaded mode", () => {
    setInput("approvers", "u1");
    setInput("base-message-ts", "1700000000.000100");
    expect(loadConfig().baseMessageTs).toBe("1700000000.000100");
  });

  it("warns when base-message-ts and base-message-payload both set", () => {
    setInput("approvers", "u1");
    setInput("base-message-ts", "1700000000.000100");
    setInput("base-message-payload", '{"text":"hi"}');
    const writes: string[] = [];
    const spy = jest.spyOn(process.stdout, "write")
      .mockImplementation((chunk: any) => { writes.push(String(chunk)); return true; });
    try { loadConfig(); } finally { spy.mockRestore(); }
    expect(writes.some(w => w.includes("base-message-payload ignored"))).toBe(true);
  });

  it("throws when SLACK_BOT_TOKEN missing", () => {
    setInput("approvers", "u1");
    delete process.env.SLACK_BOT_TOKEN;
    expect(() => loadConfig()).toThrow(/SLACK_BOT_TOKEN/);
  });

  it("does not throw when SLACK_SIGNING_SECRET is missing (socket mode)", () => {
    setInput("approvers", "u1");
    delete process.env.SLACK_SIGNING_SECRET;
    expect(() => loadConfig()).not.toThrow();
  });

  it("throws when channel id missing in both input and env", () => {
    setInput("approvers", "u1");
    delete process.env.SLACK_CHANNEL_ID;
    expect(() => loadConfig()).toThrow(/channel-id/);
  });
});
