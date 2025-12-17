import chalk from 'chalk';

interface EnvVariables {
    GITHUB_TOKEN: string;
    GITHUB_REPO: string;
    AUR_USERNAME: string;
    AUR_EMAIL: string;
    PACKAGE_NAME: string;
    MAINTAINER_NAME: string;
    MAINTAINER_EMAIL: string;
    GPG_KEY_ID?: string;
}

export class Env {
    private rawEnv: Record<string, string> = {};
    public env!: EnvVariables;

    constructor() {
        if (!this.verifyEnv(true)) {
            this.loadEnv();
            void this.verifyEnv();
        } else {
            this.env = process.env as unknown as EnvVariables;
        }
    }

    async loadEnv() {
        const envFile = Bun.file('.env');
        if (!await envFile.exists()) {
            console.error(chalk.red('.env file not found.'));
            process.exit(1);
        }

        const envText = await envFile.text();
        const env: Record<string, string> = {};

        for (const line of envText.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                env[key as keyof typeof env] = valueParts.join('=');
            }
        }

        this.rawEnv = env;
    }

    verifyEnv(plsNoKill?: boolean): boolean {
        const requiredVars = [
            'GITHUB_TOKEN',
            'GITHUB_REPO',
            'AUR_USERNAME',
            'AUR_EMAIL',
            'PACKAGE_NAME',
            'MAINTAINER_NAME',
            'MAINTAINER_EMAIL'
        ];
        let missingVars: string[] = [];
        if (!this.rawEnv || Object.keys(this.rawEnv).length === 0) {
            missingVars = requiredVars.filter(varName => !(varName in process.env));
        } else {
            missingVars = requiredVars.filter(varName => !(varName in this.rawEnv));
        }

        if (missingVars.length > 0) {
            if (plsNoKill) {
                return false;
            }
            console.error(chalk.red(`Missing required environment variables: ${missingVars.join(', ')}`));
            process.exit(1);
        }

        this.env = this.rawEnv as unknown as EnvVariables;
        return true;
    }

    get(key: keyof EnvVariables): typeof this.env[keyof EnvVariables] {
        return this.env[key];
    }

}

const envInstance = new Env();
export const env = envInstance.env;