export type ApproveResult =
  | "approved"
  | "remaining"
  | "not-authorized"
  | "already-approved";

export type RejectResult =
  | "rejected"
  | "remaining"
  | "not-authorized"
  | "already-rejected";

export interface ApprovalRecord {
  user: string;
  ts: number;
}

export class ApprovalState {
  private eligible: Set<string>;
  private approvals: ApprovalRecord[] = [];
  private rejections: ApprovalRecord[] = [];
  private readonly minimum: number;
  private readonly minimumRejects: number;
  private mutex: Promise<unknown> = Promise.resolve();

  constructor(
    eligible: string[],
    minimumApprovals: number,
    minimumRejects = 1,
  ) {
    this.eligible = new Set(eligible);
    this.minimum = minimumApprovals;
    this.minimumRejects = minimumRejects;
  }

  get minimumCount(): number {
    return this.minimum;
  }

  get minimumRejectCount(): number {
    return this.minimumRejects;
  }

  async tryApprove(userId: string): Promise<ApproveResult> {
    return this.serialize<ApproveResult>(() => {
      if (this.approvals.some(a => a.user === userId)) return "already-approved";
      if (!this.eligible.has(userId)) return "not-authorized";
      this.approvals.push({ user: userId, ts: Date.now() });
      return this.approvals.length >= this.minimum ? "approved" : "remaining";
    });
  }

  async tryReject(userId: string): Promise<RejectResult> {
    return this.serialize<RejectResult>(() => {
      if (this.rejections.some(r => r.user === userId)) return "already-rejected";
      if (!this.eligible.has(userId)) return "not-authorized";
      this.rejections.push({ user: userId, ts: Date.now() });
      return this.rejections.length >= this.minimumRejects ? "rejected" : "remaining";
    });
  }

  private async serialize<T>(fn: () => T): Promise<T> {
    const next = this.mutex.then(() => fn());
    this.mutex = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  getApprovers(): string[] {
    return this.approvals.map(a => a.user);
  }

  getApprovalRecords(): ApprovalRecord[] {
    return [...this.approvals];
  }

  getRejecters(): string[] {
    return this.rejections.map(r => r.user);
  }

  getRejectionRecords(): ApprovalRecord[] {
    return [...this.rejections];
  }

  getRemaining(): string[] {
    const approved = new Set(this.approvals.map(a => a.user));
    return [...this.eligible].filter(u => !approved.has(u));
  }

  isComplete(): boolean {
    return this.approvals.length >= this.minimum;
  }
}
