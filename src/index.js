const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

async function runCmd(command, args, options = {}) {
  await exec.exec(command, args, {
    failOnStdErr: false,
    ignoreReturnCode: false,
    ...options
  });
}

async function installTinx({ version, installUrl }) {
  const installDir = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'tinx-bin');
  await fsp.mkdir(installDir, { recursive: true });

  core.exportVariable('TINX_INSTALL_DIR', installDir);
  core.exportVariable('TINX_BIN', path.join(installDir, 'tinx'));
  core.addPath(installDir);

  const shellScript = `set -euo pipefail\nexport TINX_INSTALL_DIR=${JSON.stringify(installDir)}\nexport TINX_VERSION=${JSON.stringify(version)}\ncurl -fsSL ${JSON.stringify(installUrl)} | bash`;
  await runCmd('bash', ['-lc', shellScript]);

  const tinxBin = path.join(installDir, 'tinx');
  await fsp.access(tinxBin, fs.constants.X_OK);
  await runCmd(tinxBin, ['version']);

  return tinxBin;
}

async function runRelease({ tinxBin, registry, delegateGoreleaser, workingDirectory }) {
  const args = ['release'];

  if (delegateGoreleaser) {
    args.push('--delegate-goreleaser');
  }

  args.push('--push', registry);

  await runCmd(tinxBin, args, { cwd: workingDirectory });
}

async function main() {
  try {
    const registry = core.getInput('registry', { required: true });
    const delegateGoreleaser = core.getBooleanInput('delegate-goreleaser');
    const workingDirectoryInput = core.getInput('working-directory') || '.';
    const tinxVersion = core.getInput('tinx-version') || 'v0.1.4';
    const installUrl = core.getInput('install-url') || 'https://raw.githubusercontent.com/sourceplane/tinx/main/install.sh';

    const workingDirectory = path.resolve(process.cwd(), workingDirectoryInput);

    const tinxBin = await installTinx({ version: tinxVersion, installUrl });

    await runRelease({
      tinxBin,
      registry,
      delegateGoreleaser,
      workingDirectory
    });
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

main();
