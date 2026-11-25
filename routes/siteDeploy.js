const crypto = require('crypto');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
let deploymentRunning = false;

function isValidSignature(rawBody, supplied, secret) {
  if (!rawBody || typeof supplied !== 'string') return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

module.exports = function registerSiteDeployRoute({ config }) {
  const router = require('express').Router();

  router.post('/updatesite', (req, res) => {
    const deploy = config.siteDeploy;
    if (!deploy.secret || !deploy.repository) {
      return res.status(503).json({ error: 'Website deployment is not configured' });
    }
    if (!isValidSignature(req.rawBody, req.get('x-hub-signature-256'), deploy.secret)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    if (req.get('x-github-event') !== 'push' || !req.body || req.body.ref !== `refs/heads/${deploy.branch}`) {
      return res.status(202).json({ ignored: true, reason: 'Only pushes to the configured branch are deployed' });
    }
    if (deploymentRunning) {
      return res.status(409).json({ error: 'A website deployment is already running' });
    }

    deploymentRunning = true;
    res.status(202).json({ success: true, deployment: 'started' });

    deploySite(deploy)
      .catch(error => console.error('Website deployment failed:', error.message))
      .finally(() => { deploymentRunning = false; });
  });

  return router;
};

async function deploySite(deploy) {
  let tempDir;
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dowscopemedia-site-'));
    const checkoutDir = path.join(tempDir, 'source');
    await execFileAsync('git', [
      'clone', '--depth', '1', '--branch', deploy.branch, deploy.repository, checkoutDir
    ], { timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
    await execFileAsync('npm', ['ci'], {
      cwd: checkoutDir,
      timeout: 300000,
      maxBuffer: 4 * 1024 * 1024
    });
    await execFileAsync('npm', ['run', 'build'], {
      cwd: checkoutDir,
      timeout: 300000,
      maxBuffer: 4 * 1024 * 1024
    });

    const outputDir = path.resolve(checkoutDir, deploy.buildOutput);
    if (!outputDir.startsWith(`${checkoutDir}${path.sep}`)) {
      throw new Error('SITE_BUILD_OUTPUT must be inside the checked out repository');
    }
    const outputStat = await fs.stat(outputDir);
    if (!outputStat.isDirectory()) throw new Error('Configured build output is not a directory');

    await fs.mkdir(deploy.webRoot, { recursive: true });
    await execFileAsync('rsync', ['--archive', '--delete', `${outputDir}${path.sep}`, `${deploy.webRoot}${path.sep}`], {
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024
    });
    console.log(`Website deployment completed for ${deploy.branch}`);
  } finally {
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
