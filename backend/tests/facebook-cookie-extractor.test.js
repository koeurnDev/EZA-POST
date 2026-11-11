const test = require("node:test");
const assert = require("node:assert/strict");
const extractor = require("../services/facebookCookieExtractor");

test("Facebook Extractor: isToken identifies valid EAAG/EAAB tokens", () => {
  const validToken1 = "EAAG" + "A".repeat(120);
  const validToken2 = "EAAB" + "B".repeat(120);
  const validToken3 = "EAAI" + "C".repeat(100);

  assert.equal(extractor.isToken(validToken1), true);
  assert.equal(extractor.isToken(validToken2), true);
  assert.equal(extractor.isToken(validToken3), true);

  // Invalid tokens
  assert.equal(extractor.isToken("c_user=1000123; xs=abcdef;"), false);
  assert.equal(extractor.isToken("EAAshort"), false);
  assert.equal(extractor.isToken(""), false);
  assert.equal(extractor.isToken(null), false);
});

test("Facebook Extractor: extractTokenFromText extracts EAAG/EAAB patterns from HTML/JSON", () => {
  const sampleHtmlWithEaag = `
    <html>
      <head><title>Meta Business</title></head>
      <body>
        <script>
          window.__accessToken = "EAAG1234567890abcdefghijklmnopqrstuvwxyz_SECRET_TOKEN";
        </script>
      </body>
    </html>
  `;

  const extracted = extractor.extractTokenFromText(sampleHtmlWithEaag);
  assert.ok(extracted, "Should extract token");
  assert.ok(extracted.startsWith("EAAG"));
  assert.equal(extracted, "EAAG1234567890abcdefghijklmnopqrstuvwxyz_SECRET_TOKEN");
});

test("Facebook Extractor: extractTokenFromText handles JSON escaped accessToken", () => {
  const sampleJson = `{"status":"ok","accessToken":"EAAB999888777abcdefghijklmnopqr_TEST"}`;
  const extracted = extractor.extractTokenFromText(sampleJson);
  assert.equal(extracted, "EAAB999888777abcdefghijklmnopqr_TEST");
});

test("Facebook Extractor: cookie validation rejects invalid strings missing c_user/xs", async () => {
  await assert.rejects(
    async () => {
      await extractor.extractTokenFromCookie("random_useless_cookie=123");
    },
    {
      message: /Invalid Facebook Cookie/,
    }
  );
});

test("Facebook Extractor: auto-parses Cookie-Editor JSON array format", async () => {
  const jsonExport = JSON.stringify([
    { name: "c_user", value: "1000123456789" },
    { name: "xs", value: "abcdef123456" },
    { name: "datr", value: "xyz987" }
  ]);

  // If this throws "Invalid Facebook Cookie", it means it didn't parse JSON.
  // We expect it to parse and pass cookie check (then fail network since it's mock).
  try {
    await extractor.extractTokenFromCookie(jsonExport);
  } catch (err) {
    // Should NOT be "Invalid Facebook Cookie"
    assert.notEqual(err.message, "Invalid Facebook Cookie. It must contain 'c_user' and 'xs'.");
  }
});

