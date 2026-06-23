import { describe, it, expect } from "vitest";
import {
  MAX_LOGIN_ATTEMPTS,
  LOGIN_WINDOW_MINUTES,
} from "../src/lib/rate-limit.ts";

describe("rate-limit constants", () => {
  it("MAX_LOGIN_ATTEMPTS is 5", () => {
    expect(MAX_LOGIN_ATTEMPTS).toBe(5);
  });

  it("LOGIN_WINDOW_MINUTES is 15", () => {
    expect(LOGIN_WINDOW_MINUTES).toBe(15);
  });
});
