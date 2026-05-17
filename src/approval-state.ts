export type ApproveResult =
  | "approved"
  | "remaining"
  | "not-authorized"
  | "already-approved";

export class ApprovalState {
  private required: Set<string>;
  private approved: string[] = [];
  private readonly minimum: number;
  private mutex: Promise<void> = Promise.resolve();

  constructor(required: string[], minimum: number) {
    this.required = new Set(required);
    this.minimum = minimum;
  }

  get minimumCount(): number {
    return this.minimum;
  }

  async tryApprove(userId: string): Promise<ApproveResult> {
    let outcome: ApproveResult = "not-authorized";
    const next = this.mutex.then(() => {
      if (this.approved.includes(userId)) {
        outcome = "already-approved";
        return;
      }
      if (!this.required.has(userId)) {
        outcome = "not-authorized";
        return;
      }
      this.required.delete(userId);
      this.approved.push(userId);
      outcome = this.approved.length >= this.minimum ? "approved" : "remaining";
    });
    this.mutex = next;
    await next;
    return outcome;
  }

  getApprovers(): string[] {
    return [...this.approved];
  }

  getRemaining(): string[] {
    return [...this.required];
  }

  isComplete(): boolean {
    return this.approved.length >= this.minimum;
  }
}
