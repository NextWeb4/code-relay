'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release-assets');
const outputFile = path.join(releaseDir, 'SHA256SUMS.txt');

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const file = await fs.open(filePath, 'r');
  try {
    for await (const chunk of file.readableWebStream()) {
      hash.update(Buffer.from(chunk));
    }
  } finally {
    await file.close();
  }
  return hash.digest('hex');
}

async function main() {
  const entries = await fs.readdir(releaseDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name !== 'SHA256SUMS.txt')
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const lines = [];
  for (const file of files) {
    const digest = await hashFile(path.join(releaseDir, file));
    lines.push(`${digest}  ${file}`);
  }
  await fs.writeFile(outputFile, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Created ${path.relative(rootDir, outputFile)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
