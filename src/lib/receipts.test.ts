import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { AxiosError, AxiosHeaders } from "axios";
import { api, sendChatMessage } from "./api";

const previousAdapter = api.defaults.adapter;
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  api.defaults.adapter = previousAdapter;
  vi.unstubAllGlobals();
});

it("reuses the receipt after transport failure and retires it after success", async () => {
  const keys: string[] = [];
  api.defaults.adapter = async (config) => {
    keys.push(String(config.headers.get("Idempotency-Key")));
    if (keys.length === 1)
      throw new AxiosError("offline", "ERR_NETWORK", config);
    return {
      data: {
        answer: "answer",
        thread_id: "thread",
        peppercorns_remaining: 49,
      },
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    };
  };
  const request = {
    message: "question",
    provider: "gemini" as const,
    language: "java",
  };
  await expect(sendChatMessage(request)).rejects.toThrow("offline");
  await sendChatMessage(request);
  await sendChatMessage(request);
  expect(keys[0]).toBe(keys[1]);
  expect(keys[2]).not.toBe(keys[1]);
});

it("uses a different receipt when the input changes", async () => {
  const keys: string[] = [];
  api.defaults.adapter = async (config) => {
    keys.push(String(config.headers.get("Idempotency-Key")));
    throw new AxiosError("offline", "ERR_NETWORK", config);
  };
  for (const message of ["first", "second"])
    await expect(
      sendChatMessage({ message, provider: "gemini", language: "java" }),
    ).rejects.toThrow();
  expect(keys[0]).not.toBe(keys[1]);
});
