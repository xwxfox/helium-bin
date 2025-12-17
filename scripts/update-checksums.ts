#!/usr/bin/env bun
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { GitHubAPI, calculateSha256 } from './utils/github';
import type { PkgbuildData } from './utils/types';
import { env } from './utils/env';

async function main() {
    // Load metadata
    const metadataPath = './output/metadata.json';
    if (!existsSync(metadataPath)) {
        console.error(chalk.red('metadata.json not found.  Run `bun run generate` first.'));
        process.exit(1);
    }

    const metadata: PkgbuildData = await Bun.file(metadataPath).json();
    const github = new GitHubAPI(env.GITHUB_TOKEN, env.GITHUB_REPO);

    const downloadDir = './downloads';
    if (!existsSync(downloadDir)) {
        mkdirSync(downloadDir, { recursive: true });
    }

    const checksums: Record<string, string> = {};

    // Download and calc checksums
    for (const [arch, url] of [
        ['x86_64', metadata.sourceX86_64],
        ['aarch64', metadata.sourceAarch64]
    ]) {
        if (!url) continue;

        const fileName = url.split('/').pop() || `helium-${arch}.tar.xz`;
        const filePath = join(downloadDir, fileName);

        const spinner = ora(`Downloading ${arch} package...`).start();

        try {
            await github.downloadAsset(url, filePath);
            spinner.text = `Calculating ${arch} checksum...`;

            const checksum = await calculateSha256(filePath);
            checksums[arch ?? "x86_64"] = checksum;

            spinner.succeed(`${arch}:  ${chalk.green(checksum)}`);
        } catch (error) {
            spinner.fail(`Failed for ${arch}: ${error}`);
        }
    }

    // Update PKGBUILD
    const spinner = ora('Updating PKGBUILD...').start();
    const pkgbuildPath = './output/PKGBUILD';
    let pkgbuild = await Bun.file(pkgbuildPath).text();

    if (checksums.x86_64) {
        pkgbuild = pkgbuild.replace(/sha256sums_x86_64=\('.*?'\)/, `sha256sums_x86_64=('${checksums.x86_64}')`);
    }

    if (checksums.aarch64) {
        pkgbuild = pkgbuild.replace(/sha256sums_aarch64=\('.*?'\)/, `sha256sums_aarch64=('${checksums.aarch64}')`);
    }

    await Bun.write(pkgbuildPath, pkgbuild);

    // Update metadata
    metadata.sha256sumsX86_64 = checksums.x86_64 || 'SKIP';
    metadata.sha256sumsAarch64 = checksums.aarch64 || 'SKIP';
    await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));

    spinner.succeed('PKGBUILD updated with checksums!');
    console.log(chalk.green('Checksums calculated and updated successfully'));
}

main().catch(console.error);