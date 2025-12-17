import type { GHRelease, GHReleaseAsset, HeliumRelease } from './types';

export class GitHubAPI {
    private token: string;
    private repo: string;

    constructor(token: string, repo: string) {
        this.token = token;
        this.repo = repo;
    }

    async getLatestRelease(): Promise<HeliumRelease> {
        const url = `https://api.github.com/repos/${this.repo}/releases/latest`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Helium-AUR-Automation'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch release: ${response.statusText}`);
        }

        const data = await response.json() as GHRelease

        return {
            version: data.tag_name.replace(/^v/, ''),
            tagName: data.tag_name,
            publishedAt: data.published_at,
            assets: data.assets.map((asset: GHReleaseAsset) => ({
                name: asset.name,
                downloadUrl: asset.browser_download_url,
                size: asset.size,
                contentType: asset.content_type
            }))
        };
    }

    async downloadAsset(url: string, outputPath: string): Promise<void> {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/octet-stream',
                'User-Agent': 'Helium-AUR-Automation'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to download asset: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        await Bun.write(outputPath, buffer);
    }
}

export async function calculateSha256(filePath: string): Promise<string> {
    const file = Bun.file(filePath);
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(await file.arrayBuffer());
    return hasher.digest('hex');
}