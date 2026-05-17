import { createHash } from "node:crypto";

const map = new Map<string, string>();

export function mintActionId(seed: string): string {
  const id = createHash("sha1").update(seed).digest("hex").slice(0, 16);
  map.set(id, seed);
  return id;
}

export function lookupActionId(id: string): string | undefined {
  return map.get(id);
}

export function clearActionIds(): void {
  map.clear();
}
