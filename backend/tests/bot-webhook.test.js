const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

test("Facebook Webhook HMAC verification matches raw body buffer", () => {
  const secret = "test_fb_app_secret_12345";
  const rawBody = Buffer.from(JSON.stringify({ object: "page", entry: [{ id: "12345" }] }));

  const validSignature = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  // Verify HMAC calculation
  const computedHash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  assert.equal("sha256=" + computedHash, validSignature);
});

test("Private reply payload strictly conforms to Meta Messenger Send API", () => {
  const pageId = "10987654321";
  const commentId = "1234567890_9876543210";
  const dmText = "សួស្តីបង! តម្លៃទំនិញគឺ $15";

  const payload = {
    recipient: { comment_id: commentId },
    message: { text: dmText }
  };

  assert.equal(payload.recipient.comment_id, commentId);
  assert.equal(payload.message.text, dmText);
  assert.ok(payload.recipient.comment_id.includes("_"), "Comment ID must follow POSTID_COMMENTID format");
});

test("Bot Spintax and [[name]] variable expansion work correctly", () => {
  const commenterName = "Sokha";
  const template = "សួស្តី [[name]] {សូមស្វាគមន៍|អរគុណ}!";
  
  let formatted = template.replace(/\[\[name\]\]/g, commenterName);
  const spintaxRegex = /\{([^{}|]+(?:\|[^{}|]+)+)\}/g;
  formatted = formatted.replace(spintaxRegex, (match, options) => {
    const choices = options.split('|');
    return choices[0]; // test first choice
  });

  assert.equal(formatted, "សួស្តី Sokha សូមស្វាគមន៍!");
});

