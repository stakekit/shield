const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const platform = os.platform();
const arch = os.arch();
const binaryName =
  platform === 'win32' ? 'shield.exe' : `shield-${platform}-${arch}`;
const nodePath = process.execPath;

console.log(`Building SEA for ${platform}-${arch}...`);

// Step 1: Copy node binary
console.log('Copying Node.js binary...');
fs.copyFileSync(nodePath, binaryName);

// Step 2: Platform-specific injection
console.log('Injecting SEA blob...');

if (platform === 'darwin') {
  // macOS: remove signature, inject, re-sign
  execSync(`codesign --remove-signature ${binaryName}`, { stdio: 'inherit' });
  execSync(
    `npx postject ${binaryName} NODE_SEA_BLOB sea-prep.blob ` +
      `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 ` +
      `--macho-segment-name NODE_SEA`,
    { stdio: 'inherit' },
  );
  execSync(`codesign --sign - ${binaryName}`, { stdio: 'inherit' });
} else if (platform === 'win32') {
  // Windows
  execSync(
    `npx postject ${binaryName} NODE_SEA_BLOB sea-prep.blob ` +
      `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { stdio: 'inherit' },
  );
} else {
  // Linux
  execSync(
    `npx postject ${binaryName} NODE_SEA_BLOB sea-prep.blob ` +
      `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { stdio: 'inherit' },
  );
}

// Step 3: Verify
const stats = fs.statSync(binaryName);
console.log(
  `✅ Built ${binaryName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`,
);
