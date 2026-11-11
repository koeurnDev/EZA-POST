const test = require("node:test");
const assert = require("node:assert/strict");
const fb = require("../utils/fb");

test("Page Cleaner: batchDeletePosts handles empty array gracefully", async () => {
  const result = await fb.batchDeletePosts("fake_token", []);
  assert.equal(result.success, true);
  assert.equal(result.total, 0);
  assert.equal(result.deletedCount, 0);
  assert.equal(result.failedCount, 0);
  assert.deepEqual(result.results, []);
});

test("Page Cleaner: chunkSize chunks postIds into batches of 50", () => {
  const postIds = Array.from({ length: 125 }, (_, i) => `post_${i}`);
  const chunkSize = 50;
  const chunks = [];

  for (let i = 0; i < postIds.length; i += chunkSize) {
    chunks.push(postIds.slice(i, i + chunkSize));
  }

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 50);
  assert.equal(chunks[1].length, 50);
  assert.equal(chunks[2].length, 25);
  assert.equal(chunks[0][0], "post_0");
  assert.equal(chunks[2][24], "post_124");
});

test("Page Cleaner: confirmation validator accepts 'DELETE' and 'លុប'", () => {
  const isValidConfirmation = (str) => str === "DELETE" || str === "លុប";

  assert.equal(isValidConfirmation("DELETE"), true);
  assert.equal(isValidConfirmation("លុប"), true);
  assert.equal(isValidConfirmation("delete"), false);
  assert.equal(isValidConfirmation(""), false);
  assert.equal(isValidConfirmation(null), false);
});

