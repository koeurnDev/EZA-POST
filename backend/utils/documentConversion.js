const conversionTargets = new Map([
  [".pdf", new Set(["docx", "pptx"])],
  [".doc", new Set(["pdf", "pptx"])],
  [".docx", new Set(["pdf", "pptx"])],
  [".ppt", new Set(["pdf"])],
  [".pptx", new Set(["pdf"])],
]);

const outputFormats = {
  pdf: {
    extension: ".pdf",
    mimeType: "application/pdf",
  },
  docx: {
    extension: ".docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  pptx: {
    extension: ".pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
};

function isSupportedConversion(inputExtension, targetFormat) {
  return conversionTargets.get(inputExtension)?.has(targetFormat) ?? false;
}

function matchesDocumentSignature(extension, header) {
  if (extension === ".pdf") return header.indexOf("%PDF-") !== -1;
  if ([".doc", ".ppt"].includes(extension)) {
    return header.subarray(0, 8).equals(Buffer.from("D0CF11E0A1B11AE1", "hex"));
  }
  if ([".docx", ".pptx"].includes(extension)) {
    return header.subarray(0, 4).equals(Buffer.from("504B0304", "hex"));
  }
  return false;
}

function getOfficeMimeType(extension) {
  const mimeTypes = {
    ".doc": "application/msword",
    ".docx": outputFormats.docx.mimeType,
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": outputFormats.pptx.mimeType,
  };
  return mimeTypes[extension] ?? null;
}

module.exports = {
  getOfficeMimeType,
  isSupportedConversion,
  matchesDocumentSignature,
  outputFormats,
};
