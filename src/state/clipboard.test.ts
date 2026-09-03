// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

afterEach(() => {
  setClipboard(undefined);
});

describe("copyText", () => {
  it("writes the text and resolves true", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("resolves false when the clipboard API is missing", async () => {
    setClipboard(undefined);
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("resolves false when writeText is not a function", async () => {
    setClipboard({});
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("resolves false when writeText rejects", async () => {
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error("NotAllowedError"))) });
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("resolves false when writeText throws synchronously", async () => {
    setClipboard({
      writeText: () => {
        throw new Error("boom");
      },
    });
    await expect(copyText("hello")).resolves.toBe(false);
  });
});
