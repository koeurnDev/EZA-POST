const test = require("node:test");
const assert = require("node:assert/strict");
const {
    getOfficeMimeType,
    isSupportedConversion,
    matchesDocumentSignature,
    outputFormats,
} = require("../utils/documentConversion");

test("allows only implemented document conversion pairs", () => {
    assert.equal(isSupportedConversion(".pdf", "docx"), true);
    assert.equal(isSupportedConversion(".pdf", "pptx"), true);
    assert.equal(isSupportedConversion(".doc", "pdf"), true);
    assert.equal(isSupportedConversion(".docx", "pptx"), true);
    assert.equal(isSupportedConversion(".ppt", "pdf"), true);
    assert.equal(isSupportedConversion(".pptx", "docx"), false);
    assert.equal(isSupportedConversion(".pdf", "pdf"), false);
    assert.equal(isSupportedConversion(".docm", "pdf"), false);
});

test("recognizes supported file signatures independently of their names", () => {
    assert.equal(matchesDocumentSignature(".pdf", Buffer.from("%PDF-1.7")), true);
    assert.equal(matchesDocumentSignature(".pdf", Buffer.from("not a PDF")), false);
    assert.equal(
        matchesDocumentSignature(".doc", Buffer.from("D0CF11E0A1B11AE1", "hex")),
        true
    );
    assert.equal(
        matchesDocumentSignature(".pptx", Buffer.from("504B0304", "hex")),
        true
    );
    assert.equal(matchesDocumentSignature(".docx", Buffer.from("MZ")), false);
});

test("maps office inputs and supported outputs to their official MIME types", () => {
    assert.equal(getOfficeMimeType(".doc"), "application/msword");
    assert.equal(getOfficeMimeType(".pptx"), outputFormats.pptx.mimeType);
    assert.equal(getOfficeMimeType(".unknown"), null);
    assert.equal(outputFormats.pdf.extension, ".pdf");
});
