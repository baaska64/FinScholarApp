import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { isNewerVersion } from '../utils/appVersion.ts';
import { CHANGELOG, LATEST_RELEASE, releaseFor } from '../constants/changelog.ts';
import { Tints } from '../constants/Theme.ts';

const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export function runReleaseTests(describe, test) {
  describe('Release Suite 1: Version metadata is consistent', () => {
    test('1.1 app.json carries a three-part version and a whole versionCode', () => {
      assert(/^\d+\.\d+\.\d+$/.test(appJson.expo.version), `version is "${appJson.expo.version}"`);
      assert(Number.isInteger(appJson.expo.android.versionCode), 'versionCode must be an integer');
      assert(appJson.expo.android.versionCode > 0);
    });

    test('1.2 package.json and app.json agree on the version', () => {
      // These drifted for three releases (1.0.5 vs 1.0.7), which makes any
      // "what shipped?" question a guess.
      assert.strictEqual(
        packageJson.version,
        appJson.expo.version,
        'package.json and app.json versions have drifted apart'
      );
    });

    test('1.3 The changelog documents the version being shipped', () => {
      // A bump with no release notes is how the old modal ended up advertising
      // features from two versions earlier.
      assert.strictEqual(
        LATEST_RELEASE.version,
        appJson.expo.version,
        `app.json is on ${appJson.expo.version} but the newest changelog entry is ${LATEST_RELEASE.version}`
      );
    });
  });

  describe('Release Suite 2: Changelog content', () => {
    test('2.1 Entries are unique and ordered newest first', () => {
      const versions = CHANGELOG.map((e) => e.version);
      assert.strictEqual(new Set(versions).size, versions.length, 'Duplicate version in the changelog');
      for (let i = 1; i < versions.length; i++) {
        assert(
          isNewerVersion(versions[i], versions[i - 1]),
          `${versions[i - 1]} should be newer than ${versions[i]} — the list is not newest-first`
        );
      }
    });

    test('2.2 Every entry is complete and readable', () => {
      for (const entry of CHANGELOG) {
        assert(/^\d+\.\d+\.\d+$/.test(entry.version), `Bad version "${entry.version}"`);
        assert(entry.date && entry.date.length > 3, `${entry.version} needs a date`);
        assert(entry.headline && entry.headline.length > 10, `${entry.version} needs a headline`);
        assert(Array.isArray(entry.items) && entry.items.length > 0, `${entry.version} has no items`);
        // More than five and the sheet becomes a wall nobody reads.
        assert(entry.items.length <= 6, `${entry.version} lists ${entry.items.length} items`);

        for (const item of entry.items) {
          assert(item.title && item.title.length > 3, `${entry.version}: an item has no title`);
          assert(item.desc && item.desc.length > 20, `${entry.version}: "${item.title}" needs a real description`);
          assert(item.icon && item.icon.length > 0, `${entry.version}: "${item.title}" needs an icon`);
          assert(
            Object.prototype.hasOwnProperty.call(Tints.light, item.tint),
            `${entry.version}: "${item.title}" uses tint "${item.tint}", which is not a domain tint`
          );
        }
      }
    });

    test('2.3 releaseFor resolves a known version and falls back to the newest', () => {
      assert.strictEqual(releaseFor(LATEST_RELEASE.version), LATEST_RELEASE);
      assert.strictEqual(releaseFor('1.0.7').version, '1.0.7');
      assert.strictEqual(releaseFor('0.0.1'), LATEST_RELEASE, 'An unlisted version shows the newest notes');
      assert.strictEqual(releaseFor(''), LATEST_RELEASE);
    });
  });

  describe('Release Suite 3: Update prompt version comparison', () => {
    test('3.1 Only a genuinely newer version prompts', () => {
      assert.strictEqual(isNewerVersion('1.1.0', '1.1.1'), true);
      assert.strictEqual(isNewerVersion('1.1.0', '1.2.0'), true);
      assert.strictEqual(isNewerVersion('1.1.0', '2.0.0'), true);
      assert.strictEqual(isNewerVersion('1.9.9', '1.10.0'), true, 'Parts compare numerically, not as text');

      assert.strictEqual(isNewerVersion('1.1.0', '1.1.0'), false, 'Same version must never prompt');
      assert.strictEqual(isNewerVersion('1.1.0', '1.0.9'), false);
      assert.strictEqual(isNewerVersion('2.0.0', '1.9.9'), false);
      assert.strictEqual(isNewerVersion('1.10.0', '1.9.9'), false);
    });

    test('3.2 Short and prefixed versions are handled', () => {
      assert.strictEqual(isNewerVersion('1.1', '1.1.1'), true);
      assert.strictEqual(isNewerVersion('1.1.0', '1.2'), true);
      assert.strictEqual(isNewerVersion('1.1.0', 'v1.2.0'), true, 'A leading v is tolerated');
      assert.strictEqual(isNewerVersion('1.1.0', '1.1.1-beta.2'), true, 'A build suffix is ignored');
      assert.strictEqual(isNewerVersion('1.1.0-beta.1', '1.1.0'), false);
    });

    test('3.3 A malformed row can never pop a dialog on every launch', () => {
      for (const bad of [null, undefined, '', '   ', 'latest', {}, [], 42, NaN, true]) {
        assert.strictEqual(isNewerVersion('1.1.0', bad), false, `latest=${String(bad)} must not prompt`);
        assert.strictEqual(isNewerVersion(bad, '9.9.9'), false, `current=${String(bad)} must not prompt`);
      }
    });

    test('3.4 Junk inside an otherwise valid version reads as zero, not NaN', () => {
      assert.strictEqual(isNewerVersion('1.0.0', '1.0.x'), false);
      assert.strictEqual(isNewerVersion('1.0.0', '1.1.x'), true);
      assert.strictEqual(isNewerVersion('1.x.0', '1.0.1'), true);
    });
  });
}
