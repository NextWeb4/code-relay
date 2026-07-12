'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const releaseDir = path.join(rootDir, 'release-assets');
const exeName = `code-relay-v${version}-win-x64.exe`;
const zipName = `code-relay-v${version}-windows-portable.zip`;
const stagingRoot = path.join(releaseDir, 'staging');
const stagingDir = path.join(stagingRoot, `code-relay-v${version}-windows-portable`);

async function copyIfExists(source, destination) {
  try {
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, destination, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function main() {
  const exePath = path.join(releaseDir, exeName);
  await fs.access(exePath);
  await fs.rm(stagingRoot, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  await fs.copyFile(exePath, path.join(stagingDir, exeName));
  await copyIfExists(path.join(rootDir, 'README.md'), path.join(stagingDir, 'README.md'));
  await copyIfExists(path.join(rootDir, 'LICENSE'), path.join(stagingDir, 'LICENSE'));
  await copyIfExists(path.join(rootDir, '.env.example'), path.join(stagingDir, '.env.example'));
  await copyIfExists(path.join(rootDir, 'docs', 'demo'), path.join(stagingDir, 'docs', 'demo'));

  await fs.writeFile(
    path.join(stagingDir, 'Start Code Relay.cmd'),
    [
      '@echo off',
      'chcp 65001 >nul',
      'cd /d "%~dp0"',
      `start "" "${exeName}"`,
      ''
    ].join('\r\n'),
    'utf8'
  );

  const zipPath = path.join(releaseDir, zipName);
  await fs.rm(zipPath, { force: true });
  const command = [
    '$ErrorActionPreference = "Stop"',
    `Compress-Archive -Path '${stagingDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error(`Compress-Archive failed with exit code ${result.status}`);
  }
  await fs.rm(stagingRoot, { recursive: true, force: true });
  console.log(`Created ${path.relative(rootDir, zipPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
