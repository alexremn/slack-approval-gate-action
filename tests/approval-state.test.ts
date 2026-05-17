import { ApprovalState } from "../src/approval-state";

describe("ApprovalState", () => {
  it("approves a single user when minimum is 1", async () => {
    const s = new ApprovalState(["u1", "u2"], 1);
    await expect(s.tryApprove("u1")).resolves.toBe("approved");
    expect(s.isComplete()).toBe(true);
    expect(s.getApprovers()).toEqual(["u1"]);
  });

  it("returns remaining when more approvals needed", async () => {
    const s = new ApprovalState(["u1", "u2"], 2);
    await expect(s.tryApprove("u1")).resolves.toBe("remaining");
    expect(s.isComplete()).toBe(false);
    await expect(s.tryApprove("u2")).resolves.toBe("approved");
    expect(s.isComplete()).toBe(true);
  });

  it("rejects unknown user as not-authorized", async () => {
    const s = new ApprovalState(["u1"], 1);
    await expect(s.tryApprove("intruder")).resolves.toBe("not-authorized");
    expect(s.isComplete()).toBe(false);
  });

  it("rejects double approval as already-approved", async () => {
    const s = new ApprovalState(["u1", "u2"], 2);
    await s.tryApprove("u1");
    await expect(s.tryApprove("u1")).resolves.toBe("already-approved");
    expect(s.getApprovers()).toEqual(["u1"]);
  });

  it("getRemaining returns currently-pending approvers", async () => {
    const s = new ApprovalState(["u1", "u2", "u3"], 2);
    await s.tryApprove("u2");
    expect(s.getRemaining().sort()).toEqual(["u1", "u3"]);
  });

  it("serializes concurrent approvals via mutex", async () => {
    const s = new ApprovalState(["u1", "u2", "u3"], 3);
    const results = await Promise.all([
      s.tryApprove("u1"),
      s.tryApprove("u2"),
      s.tryApprove("u3"),
    ]);
    expect(results.filter(r => r === "approved")).toHaveLength(1);
    expect(results.filter(r => r === "remaining")).toHaveLength(2);
    expect(s.getApprovers().sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("exposes minimumCount", () => {
    const s = new ApprovalState(["u1"], 1);
    expect(s.minimumCount).toBe(1);
  });
});
