#!/usr/bin/env bun
import { existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { AURPublisher } from './utils/aur';
import type { PkgbuildData } from './utils/types';
import { env } from './utils/env';
async function main() {
    // Check prereqs
    const pkgbuildPath = './output/PKGBUILD';
    const metadataPath = './output/metadata.json';

    if (!existsSync(pkgbuildPath)) {
        console.error(chalk.red('PKGBUILD not found. Run `bun run generate` first.'));
        process.exit(1);
    }

    if (!existsSync(metadataPath)) {
        console.error(chalk.red('metadata.json not found. Run `bun run generate` first.'));
        process.exit(1);
    }

    const metadata: PkgbuildData = await Bun.file(metadataPath).json();

    // Check if checksums are still SKIP
    if (metadata.sha256sumsX86_64 === 'SKIP' || metadata.sha256sumsAarch64 === 'SKIP') {
        console.warn(chalk.yellow('Warning: Checksums are set to SKIP. Run `bun run checksums` first.'));
        console.log(chalk.gray('Continue anyway? (y/N): '));

        // could use a prompt lib but im gay
        const answer = prompt('');
        if (answer?.toLowerCase() !== 'y') {
            console.log('Aborted.');
            process.exit(0);
        }
    }

    const {
        AUR_USERNAME,
        AUR_EMAIL,
        PACKAGE_NAME
    } = env;

    if (!AUR_USERNAME || !AUR_EMAIL || !PACKAGE_NAME) {
        console.error(chalk.red('Missing AUR configuration in .env'));
        process.exit(1);
    }

    const aur = new AURPublisher(PACKAGE_NAME, AUR_USERNAME, AUR_EMAIL);

    // Clone or update AUR repo
    let spinner = ora('Cloning/updating AUR repository...').start();
    try {
        await aur.cloneOrUpdateRepo();
        spinner.succeed('AUR repository ready');
    } catch (error) {
        spinner.fail(`Failed to clone/update AUR repo: ${error}`);
        process.exit(1);
    }

    // Copy PKGBUILD and LICENSE
    spinner = ora('Copying PKGBUILD and LICENSE...').start();
    try {
        await aur.copyFiles(pkgbuildPath, './LICENSE');
        spinner.succeed('Files copied');
    } catch (error) {
        spinner.fail(`Failed to copy files: ${error}`);
        process.exit(1);
    }

    // Generate .SRCINFO
    spinner = ora('Generating .SRCINFO...').start();
    try {
        await aur.generateSrcinfo();
        spinner.succeed('.SRCINFO generated');
    } catch (error) {
        spinner.fail(`Failed to generate .SRCINFO: ${error}`);
        process.exit(1);
    }

    // Commit
    spinner = ora('Committing changes...').start();
    try {
        await aur.commit(metadata.version);
        spinner.succeed('Changes committed');
    } catch (error) {
        spinner.fail(`Failed to commit: ${error}`);
        process.exit(1);
    }

    // Push
    console.log(chalk.yellow('Ready to push to AUR.  Continue?  (y/N): '));
    const pushAnswer = prompt('');

    if (pushAnswer?.toLowerCase() === 'y') {
        spinner = ora('Pushing to AUR...').start();
        try {
            await aur.push();
            spinner.succeed('Successfully pushed to AUR!');
            console.log(chalk.green(`Package ${PACKAGE_NAME} version ${metadata.version} published to AUR!`));
            console.log(chalk.gray(`View at: https://aur.archlinux.org/packages/${PACKAGE_NAME}`));
        } catch (error) {
            spinner.fail(`Failed to push: ${error}`);
            process.exit(1);
        }
    } else {
        console.log(chalk.gray('Push cancelled.  Changes are committed locally at: '));
        console.log(chalk.gray(`~ ${aur.getRepoPath()}\n`));
    }
}

main().catch(console.error);