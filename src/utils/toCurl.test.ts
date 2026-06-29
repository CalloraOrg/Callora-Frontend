import { describe, it, expect } from "vitest";
import { toCurl } from "./toCurl";

describe("toCurl", () => {
  it("defaults to GET", () => {
    expect(toCurl({ url: "https://api.example.com/v1/ping" })).toBe(
      "curl -X GET 'https://api.example.com/v1/ping'",
    );
  });

  it("includes headers in order", () => {
    const out = toCurl({
      url: "https://api.example.com/v1/data",
      headers: { Authorization: "Bearer xyz", Accept: "application/json" },
    });
    expect(out).toContain("-H 'Authorization: Bearer xyz'");
    expect(out).toContain("-H 'Accept: application/json'");
  });

  it("serialises an object body as JSON for POST", () => {
    const out = toCurl({
      method: "post",
      url: "https://api.example.com/v1/items",
      body: { name: "widget", qty: 2 },
    });
    expect(out).toContain("curl -X POST");
    expect(out).toContain('--data \'{"name":"widget","qty":2}\'');
  });

  it("omits the body for GET/HEAD", () => {
    const out = toCurl({
      method: "GET",
      url: "https://api.example.com/v1/items",
      body: { ignored: true },
    });
    expect(out).not.toContain("--data");
  });

  it("escapes single quotes in values safely", () => {
    const out = toCurl({
      method: "POST",
      url: "https://api.example.com/v1/echo",
      body: "it's fine",
    });
    expect(out).toContain(`--data 'it'\\''s fine'`);
  });
});
