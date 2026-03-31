type UpdateCheckResult = {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
};

/**
 * Checks GitHub Releases for `server-v*` tags to determine whether a newer
 * version of copilot-chef-server is available.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(
      "https://api.github.com/repos/copilot-chef/copilot-chef/releases",
      {
        signal: controller.signal,
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": `copilot-chef-server/${currentVersion}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return { hasUpdate: false, currentVersion };
    }

    const releases = (await response.json()) as Array<{
      tag_name: string;
      html_url: string;
      prerelease: boolean;
      draft: boolean;
    }>;

    const serverReleases = releases.filter(
      (r) => !r.prerelease && !r.draft && r.tag_name.startsWith("server-v")
    );

    if (serverReleases.length === 0) {
      return { hasUpdate: false, currentVersion };
    }

    const latest = serverReleases[0];
    const latestVersion = latest.tag_name.replace(/^server-v/, "");

    if (latestVersion === currentVersion) {
      return { hasUpdate: false, currentVersion };
    }

    const [latestMajor, latestMinor, latestPatch] = latestVersion.split(".").map(Number);
    const [curMajor, curMinor, curPatch] = currentVersion.split(".").map(Number);

    const isNewer =
      latestMajor > curMajor ||
      (latestMajor === curMajor && latestMinor > curMinor) ||
      (latestMajor === curMajor && latestMinor === curMinor && latestPatch > curPatch);

    if (!isNewer) {
      return { hasUpdate: false, currentVersion };
    }

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion,
      releaseUrl: latest.html_url,
    };
  } catch {
    return { hasUpdate: false, currentVersion };
  } finally {
    clearTimeout(timeout);
  }
}
