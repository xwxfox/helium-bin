export interface GHRelease {
    tag_name: string;
    published_at: string;
    assets: GHReleaseAsset[];
}
export interface GHReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
}
export interface HeliumRelease {
    version: string;
    tagName: string;
    publishedAt: string;
    assets: ReleaseAsset[];
}

export interface ReleaseAsset {
    name: string;
    downloadUrl: string;
    size: number;
    contentType: string;
}

export interface PkgbuildData {
    version: string;
    release: number;
    maintainer: string;
    maintainerEmail: string;
    sourceX86_64: string;
    sourceAarch64: string;
    sha256sumsX86_64: string;
    sha256sumsAarch64: string;
    gpgKeyId: string;
}

export interface ArchConfig {
    name: string;
    pattern: RegExp;
}

export const ARCHITECTURES: ArchConfig[] = [
    { name: 'x86_64', pattern: /x86_64_linux\.tar\.xz$/ },
    { name: 'aarch64', pattern: /arm64_linux\.tar\.xz$|aarch64_linux\.tar\.xz$/ }
];