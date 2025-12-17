#!/usr/bin/env bun
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { GitHubAPI } from './utils/github';
import { ARCHITECTURES, type PkgbuildData } from './utils/types';
import { env } from './utils/env';

async function main() {
    const spinner = ora('Loading configuration...').start();

    const {
        GITHUB_TOKEN,
        GITHUB_REPO,
        MAINTAINER_NAME,
        MAINTAINER_EMAIL,
        GPG_KEY_ID
    } = env;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
        spinner.fail('Missing required environment variables');
        process.exit(1);
    }

    spinner.text = 'Fetching latest release from GitHub...';
    const github = new GitHubAPI(GITHUB_TOKEN, GITHUB_REPO);
    const release = await github.getLatestRelease();

    spinner.succeed(`Found release: ${chalk.green(release.version)}`);

    // Find arch specific assets
    const assetMap = new Map<string, string>();
    for (const arch of ARCHITECTURES) {
        const asset = release.assets.find(a => arch.pattern.test(a.name));
        if (asset) {
            assetMap.set(arch.name, asset.downloadUrl);
            console.log(chalk.gray(`~ ${arch.name}: ${asset.name}`));
        } else {
            console.warn(chalk.yellow(`Warning: No asset found for ${arch.name}`));
        }
    }

    if (assetMap.size === 0) {
        console.error(chalk.red('No valid assets found for any architecture'));
        process.exit(1);
    }

    // Generate PKGBUILD data
    const pkgbuildData: PkgbuildData = {
        version: release.version,
        release: 1,
        maintainer: MAINTAINER_NAME || 'Unknown',
        maintainerEmail: MAINTAINER_EMAIL || 'unknown@example.com',
        sourceX86_64: assetMap.get('x86_64') || '',
        sourceAarch64: assetMap.get('aarch64') || '',
        sha256sumsX86_64: 'SKIP',
        sha256sumsAarch64: 'SKIP',
        gpgKeyId: GPG_KEY_ID || 'BE677C1989D35EAB2C5F26C9351601AD01D6378E'
    };

    // Load template
    spinner.start('Generating PKGBUILD.. .');
    const templatePath = join(import.meta.dir, '../templates/PKGBUILD.template');
    const template = await Bun.file(templatePath).text();

    // Replace placeholders
    const pkgbuild = template
        .replace(/\{\{VERSION\}\}/g, pkgbuildData.version)
        .replace(/\{\{RELEASE\}\}/g, pkgbuildData.release.toString())
        .replace(/\{\{MAINTAINER_NAME\}\}/g, pkgbuildData.maintainer)
        .replace(/\{\{MAINTAINER_EMAIL\}\}/g, pkgbuildData.maintainerEmail)
        .replace(/\{\{SOURCE_X86_64\}\}/g, pkgbuildData.sourceX86_64)
        .replace(/\{\{SOURCE_AARCH64\}\}/g, pkgbuildData.sourceAarch64)
        .replace(/\{\{SHA256_X86_64\}\}/g, pkgbuildData.sha256sumsX86_64)
        .replace(/\{\{SHA256_AARCH64\}\}/g, pkgbuildData.sha256sumsAarch64)
        .replace(/\{\{GPG_KEY_ID\}\}/g, pkgbuildData.gpgKeyId);

    // Write PKGBUILD
    const outputDir = './output';
    await Bun.write(join(outputDir, 'PKGBUILD'), pkgbuild);

    // Save metadata for checksum script
    await Bun.write(join(outputDir, 'metadata.json'), JSON.stringify(pkgbuildData, null, 2));

    spinner.succeed('PKGBUILD generated successfully!');

    console.log(chalk.gray('Output: '));
    console.log(chalk.gray(`~ ${join(outputDir, 'PKGBUILD')}`));
    console.log(chalk.gray(`~ ${join(outputDir, 'metadata.json')}`));

    console.log(chalk.yellow('Checksums are set to SKIP.  Run `bun run checksums` to calculate them.'));
}

main().catch(console.error);