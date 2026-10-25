const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const semver = require('semver');

const GITHUB_REPO = 'johngori/purabebot';

/**
 * Clean version string like 'v2.0.1' -> '2.0.1'
 */
function normalizeVersion(ver) {
  if (!ver) return null;
  const match = ver.match(/\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?/);
  return match ? match[0] : null;
}

/**
 * Fetch latest release from GitHub
 */
async function fetchLatestRelease() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const response = await net.fetch(url, {
    headers: {
      'User-Agent': `purabebot-updater/${app.getVersion()}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Check if a newer version is available on GitHub Releases
 */
async function checkForUpdates() {
  const currentVersion = app.getVersion();
  const release = await fetchLatestRelease();

  if (!release || !release.tag_name) {
    return { hasUpdate: false };
  }

  const latestVersion = normalizeVersion(release.tag_name);
  if (!latestVersion) {
    return { hasUpdate: false };
  }

  const hasUpdate = semver.gt(latestVersion, currentVersion);
  if (!hasUpdate) {
    return { hasUpdate: false, currentVersion, latestVersion };
  }

  // Find Windows installer (.exe)
  const assets = release.assets || [];
  let installerAsset = assets.find(a => a.name && a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup'));
  if (!installerAsset) {
    installerAsset = assets.find(a => a.name && a.name.endsWith('.exe'));
  }

  if (!installerAsset) {
    return {
      hasUpdate: true,
      hasInstaller: false,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      releaseNotes: release.body
    };
  }

  return {
    hasUpdate: true,
    hasInstaller: true,
    currentVersion,
    latestVersion,
    assetName: installerAsset.name,
    downloadUrl: installerAsset.browser_download_url,
    releaseUrl: release.html_url,
    releaseNotes: release.body
  };
}

/**
 * Download installer file with redirect support and progress callbacks
 */
function downloadInstaller(downloadUrl, version, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const destPath = path.join(app.getPath('temp'), `purabebot-setup-${version}.exe`);
      
      // Follow redirects using net.fetch
      const response = await net.fetch(downloadUrl, {
        headers: {
          'User-Agent': `purabebot-updater/${app.getVersion()}`
        }
      });

      if (!response.ok) {
        return reject(new Error(`Download failed with status: ${response.status}`));
      }

      const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
      let receivedBytes = 0;

      const fileStream = fs.createWriteStream(destPath);
      const reader = response.body.getReader();

      async function pump() {
        const { done, value } = await reader.read();
        if (done) {
          fileStream.end();
          return;
        }

        receivedBytes += value.length;
        fileStream.write(Buffer.from(value));

        if (totalBytes > 0 && typeof onProgress === 'function') {
          const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
          onProgress(percent, receivedBytes, totalBytes);
        }

        await pump();
      }

      fileStream.on('finish', () => {
        resolve(destPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });

      await pump();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Launch installer and quit current app
 */
function runInstallerAndQuit(installerPath) {
  if (!fs.existsSync(installerPath)) {
    throw new Error('Installer file not found: ' + installerPath);
  }

  const appExe = process.execPath;
  const isPackaged = app.isPackaged;

  // NSISインストーラーをサイレント(/S)で実行し、画面を出さずにインストール
  if (isPackaged) {
    // インストーラーの完了を待って自動的にアプリを再起動
    const cmd = `start /wait "" "${installerPath}" /S & start "" "${appExe}"`;
    const child = spawn('cmd.exe', ['/c', cmd], {
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments: true
    });
    child.unref();
  } else {
    // 開発時のテスト: /S でウィザードをスキップして静かに更新
    const child = spawn(installerPath, ['/S'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  }

  // 現在のアプリを終了
  app.quit();
}

module.exports = {
  checkForUpdates,
  downloadInstaller,
  runInstallerAndQuit
};
