import { $ } from 'bun';
import { existsSync } from 'fs';
import { join } from 'path';

export class AURPublisher {
    private packageName: string;
    private workDir: string;
    private username: string;
    private email: string;

    constructor(packageName: string, username: string, email: string, workDir: string = './aur-work') {
        this.packageName = packageName;
        this.workDir = workDir;
        this.username = username;
        this.email = email;
    }

    async cloneOrUpdateRepo(): Promise<void> {
        const repoPath = join(this.workDir, this.packageName);

        if (existsSync(repoPath)) {
            console.log('Updating existing AUR repository...');
            // Check if repo has any commits before pulling
            try {
                await $`cd ${repoPath} && git rev-parse HEAD`.quiet();
                await $`cd ${repoPath} && git pull --rebase`.quiet();
            } catch {
                // Empty repo, nothing to pull
                console.log('Repository is empty (new package)');
            }
        } else {
            console.log('Cloning AUR repository...');
            await $`mkdir -p ${this.workDir}`.quiet();
            await $`git -c init.defaultBranch=master clone ssh://aur@aur.archlinux.org/${this.packageName}.git ${repoPath}`.quiet();
        }

        // config git
        await $`cd ${repoPath} && git config user.name "${this.username}"`.quiet();
        await $`cd ${repoPath} && git config user.email "${this.email}"`.quiet();
    }

    async copyFiles(pkgbuildPath: string, licensePath?: string): Promise<void> {
        const repoPath = join(this.workDir, this.packageName);
        await $`cp ${pkgbuildPath} ${repoPath}/PKGBUILD`.quiet();
        if (licensePath && existsSync(licensePath)) {
            await $`cp ${licensePath} ${repoPath}/LICENSE`.quiet();
        }
    }

    async generateSrcinfo(): Promise<void> {
        const repoPath = join(this.workDir, this.packageName);
        await $`cd ${repoPath} && makepkg --printsrcinfo > .SRCINFO`.quiet();
    }

    async commit(version: string): Promise<void> {
        const repoPath = join(this.workDir, this.packageName);
        // Add files that exist
        await $`cd ${repoPath} && git add PKGBUILD .SRCINFO`.quiet();
        if (existsSync(join(repoPath, 'LICENSE'))) {
            await $`cd ${repoPath} && git add LICENSE`.quiet();
        }
        // Check if there are changes to commit
        const status = await $`cd ${repoPath} && git status --porcelain`.text();
        if (status.trim()) {
            await $`cd ${repoPath} && git commit -m "Update to version ${version}"`.quiet();
        } else {
            throw new Error('No changes to commit');
        }
    }

    async push(): Promise<void> {
        const repoPath = join(this.workDir, this.packageName);
        await $`cd ${repoPath} && git push`.quiet();
    }

    getRepoPath(): string {
        return join(this.workDir, this.packageName);
    }
}