import {
  hasPayload,
  readGithubContext,
  defaultMainPayload,
  renderApprovalReply,
  renderFinalStatus,
} from "../src/payloads";

describe("hasPayload", () => {
  it("returns false for undefined", () => {
    expect(hasPayload(undefined)).toBe(false);
  });
  it("returns false for empty object", () => {
    expect(hasPayload({})).toBe(false);
  });
  it("returns true when text is non-empty", () => {
    expect(hasPayload({ text: "hi" })).toBe(true);
  });
  it("returns false when text is empty string", () => {
    expect(hasPayload({ text: "" })).toBe(false);
  });
  it("returns true when blocks is non-empty array", () => {
    expect(hasPayload({ blocks: [{ type: "section" }] })).toBe(true);
  });
  it("returns false when blocks is empty array", () => {
    expect(hasPayload({ blocks: [] })).toBe(false);
  });
});

describe("readGithubContext", () => {
  it("reads expected env vars with empty fallback", () => {
    const orig = { ...process.env };
    process.env.GITHUB_SERVER_URL = "https://github.com";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_RUN_ID = "42";
    delete process.env.GITHUB_ACTOR;
    const ctx = readGithubContext();
    expect(ctx.serverUrl).toBe("https://github.com");
    expect(ctx.repo).toBe("owner/repo");
    expect(ctx.runId).toBe("42");
    expect(ctx.actor).toBe("");
    process.env = orig;
  });
});

describe("defaultMainPayload", () => {
  it("returns a block payload with the expected fields", () => {
    const ctx = {
      serverUrl: "https://github.com",
      repo: "owner/repo",
      runId: "42",
      runNumber: "1",
      runAttempt: "1",
      workflow: "ci",
      runnerOs: "Linux",
      actor: "alice",
    };
    const p = defaultMainPayload(ctx);
    expect(Array.isArray(p.blocks)).toBe(true);
    expect(p.blocks!.length).toBeGreaterThan(0);
    const fields = (p.blocks![1] as any).fields as Array<{ text: string }>;
    expect(fields.some(f => f.text.includes("alice"))).toBe(true);
    expect(
      fields.some(f => f.text.includes("https://github.com/owner/repo/actions/runs/42")),
    ).toBe(true);
  });
});

describe("renderApprovalReply", () => {
  it("renders title + actions blocks with action ids", () => {
    const blocks = renderApprovalReply({
      minimumCount: 2,
      remaining: ["u1", "u2"],
      approved: [],
      approveActionId: "approve-id",
      rejectActionId: "reject-id",
    });
    expect(blocks).toHaveLength(2);
    expect((blocks[0] as any).type).toBe("section");
    expect((blocks[0] as any).text.text).toContain("Required Approvers Count:* 2");
    expect((blocks[0] as any).text.text).toContain("<@u1>");
    const actions = blocks[1] as any;
    expect(actions.type).toBe("actions");
    expect(actions.elements[0].value).toBe("approve-id");
    expect(actions.elements[0].action_id).toBe("slack-approval-approve");
    expect(actions.elements[1].value).toBe("reject-id");
    expect(actions.elements[1].action_id).toBe("slack-approval-reject");
  });

  it("shows current approvers when present", () => {
    const blocks = renderApprovalReply({
      minimumCount: 2,
      remaining: ["u2"],
      approved: ["u1"],
      approveActionId: "a",
      rejectActionId: "r",
    });
    expect((blocks[0] as any).text.text).toContain("Approvers: <@u1>");
  });
});

describe("renderFinalStatus", () => {
  it("renders approved status with approver list", () => {
    const blocks = renderFinalStatus("approved", ["u1", "u2"]);
    expect((blocks[0] as any).text.text).toContain("Approved");
    expect((blocks[0] as any).text.text).toContain("<@u1>");
  });
  it("renders rejected with rejectedBy", () => {
    const blocks = renderFinalStatus("rejected", [], "u9");
    expect((blocks[0] as any).text.text).toContain("Rejected by <@u9>");
  });
  it("renders canceled", () => {
    expect((renderFinalStatus("canceled", [])[0] as any).text.text).toContain("Canceled");
  });
  it("renders timed-out", () => {
    expect((renderFinalStatus("timed-out", [])[0] as any).text.text).toContain("Timed out");
  });
});
