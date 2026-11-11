const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeCapCutUrl } = require("../utils/capcutUrl");

test("CapCut URL validation accepts HTTPS links on official CapCut hosts", () => {
  for (const value of [
    "https://www.capcut.com/template-detail/example/123",
    "https://capcut.com/t/abc123/",
    "https://m.capcut.com/template-detail/example/123?share=1",
  ]) {
    assert.equal(normalizeCapCutUrl(value), new URL(value).toString());
  }
});

test("CapCut URL validation rejects deceptive and unsafe URLs", () => {
  for (const value of [
    "http://www.capcut.com/template-detail/abc",
    "https://capcut.com.attacker.example/template-detail/abc",
    "https://attacker.example/?url=https://capcut.com/template-detail/abc",
    "https://user:password@capcut.com/template-detail/abc",
    "https://capcut.com:8443/template-detail/abc",
    "https://capcut.com/",
    "not a URL",
    "x".repeat(2049),
  ]) {
    assert.equal(normalizeCapCutUrl(value), null, value.slice(0, 80));
  }
});
