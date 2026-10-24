'use strict';

/**
 * electron-builder 会把 4 段版本号按 semver 解释成 1.26.2-0.55。
 * 构建完成后用 Windows 资源编辑器写回真实的四段版本号。
 */
const fs = require('fs');
const path = require('path');
const PELib = require('pe-library');
const ResEdit = require('resedit');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = String(pkg.version || '1.26.26.00');
const parts = version.split('.').map((n) => parseInt(n, 10) || 0);
while (parts.length < 4) parts.push(0);
const target = process.argv[2] || path.join(__dirname, '..', 'dist', 'win-unpacked', 'EMCL.exe');
if (!fs.existsSync(target)) {
  console.error('找不到可执行文件：' + target);
  process.exit(1);
}

const data = fs.readFileSync(target);
const exe = PELib.NtExecutable.from(data, { ignoreCert: true });
const res = PELib.NtExecutableResource.from(exe);
const list = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
if (!list.length) {
  console.error('可执行文件没有版本信息资源');
  process.exit(1);
}
for (const vi of list) {
  vi.setFileVersion(parts[0], parts[1], parts[2], parts[3], 1033);
  vi.setProductVersion(parts[0], parts[1], parts[2], parts[3], 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'EMCL - Enderman MineCraft Launcher',
    ProductName: 'EMCL',
    FileVersion: version,
    ProductVersion: version
  });
  vi.outputToResourceEntries(res.entries);
}
res.outputResource(exe);
fs.writeFileSync(target, Buffer.from(exe.generate()));
console.log('版本信息已写入：' + target + ' -> ' + version);
