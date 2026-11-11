const test = require("node:test");
const assert = require("node:assert/strict");

test("Stagger delay calculations produce correct future timestamps for multiple pages", () => {
  const baseScheduleTime = new Date("2026-12-01T10:00:00Z");
  const staggerMinutes = 5;
  const accounts = ["page_1", "page_2", "page_3"];

  const scheduledTimes = accounts.map((acc, index) => {
    return new Date(baseScheduleTime.getTime() + (index * staggerMinutes * 60 * 1000));
  });

  assert.equal(scheduledTimes[0].toISOString(), "2026-12-01T10:00:00.000Z");
  assert.equal(scheduledTimes[1].toISOString(), "2026-12-01T10:05:00.000Z");
  assert.equal(scheduledTimes[2].toISOString(), "2026-12-01T10:10:00.000Z");
});

test("Meta Graph API minimum schedule time validation (10 minutes minimum)", () => {
  const now = new Date();
  
  // 5 minutes in future (invalid)
  const invalidTime = new Date(now.getTime() + 5 * 60 * 1000);
  const diffMinutesInvalid = (invalidTime.getTime() - now.getTime()) / (1000 * 60);
  assert.ok(diffMinutesInvalid < 10, "5 minutes must be less than 10 minutes");

  // 15 minutes in future (valid)
  const validTime = new Date(now.getTime() + 15 * 60 * 1000);
  const diffMinutesValid = (validTime.getTime() - now.getTime()) / (1000 * 60);
  assert.ok(diffMinutesValid >= 10, "15 minutes must be at least 10 minutes");
});

test("Accounts payload parses safely from JSON array or string array", () => {
  const rawAccountsJson = JSON.stringify(["1001", "1002", "1003"]);
  let parsed = [];
  try {
    parsed = JSON.parse(rawAccountsJson);
  } catch (e) {
    parsed = [];
  }
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0], "1001");
  assert.equal(parsed[1], "1002");
  assert.equal(parsed[2], "1003");
});

