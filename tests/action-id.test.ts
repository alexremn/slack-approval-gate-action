import { mintActionId, lookupActionId, clearActionIds } from "../src/action-id";

describe("action-id", () => {
  beforeEach(() => clearActionIds());

  it("mints a short stable id for a seed", () => {
    const id = mintActionId("seed-value");
    expect(id).toMatch(/^[a-f0-9]{16}$/);
    expect(mintActionId("seed-value")).toBe(id);
  });

  it("mints different ids for different seeds", () => {
    expect(mintActionId("a")).not.toBe(mintActionId("b"));
  });

  it("looks up the original seed", () => {
    const id = mintActionId("original");
    expect(lookupActionId(id)).toBe("original");
  });

  it("returns undefined for unknown id", () => {
    expect(lookupActionId("deadbeef")).toBeUndefined();
  });

  it("clears the map", () => {
    const id = mintActionId("x");
    clearActionIds();
    expect(lookupActionId(id)).toBeUndefined();
  });
});
