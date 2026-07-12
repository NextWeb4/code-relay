'use strict';

const fs = require('node:fs');
const path = require('node:path');
const PELibrary = require('pe-library');
const ResEdit = require('resedit');
const { version } = require('../package.json');

const exePath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'release-assets', `code-relay-v${version}-win-x64.exe`));
const lang = 1033;
const codepage = 1200;

const data = fs.readFileSync(exePath);
const executable = PELibrary.NtExecutable.from(data, { ignoreCert: true });
const resources = PELibrary.NtExecutableResource.from(executable);
const versionInfo = ResEdit.Resource.VersionInfo.fromEntries(resources.entries)[0] ||
  ResEdit.Resource.VersionInfo.createEmpty();

versionInfo.setFileVersion(1, 0, 0, 0, lang);
versionInfo.setProductVersion(1, 0, 0, 0, lang);
versionInfo.setStringValues(
  { lang, codepage },
  {
    CompanyName: 'HaoXiang Huang',
    FileDescription: 'Code Relay',
    FileVersion: version,
    InternalName: 'Code Relay',
    LegalCopyright: 'Copyright (c) 2026 HaoXiang Huang',
    OriginalFilename: path.basename(exePath),
    ProductName: 'Code Relay',
    ProductVersion: version,
    Comments: 'https://nextweb4.github.io/'
  },
  true
);
versionInfo.outputToResourceEntries(resources.entries);
resources.outputResource(executable);
fs.writeFileSync(exePath, Buffer.from(executable.generate()));
console.log(`Patched metadata for ${path.relative(path.resolve(__dirname, '..'), exePath)}`);
