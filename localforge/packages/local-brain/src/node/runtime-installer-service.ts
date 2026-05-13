import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { injectable } from '@theia/core/shared/inversify';
import { RuntimeInstallStatus, DownloadTaskStatus } from '../common/protocol';

@injectable()
export class RuntimeInstallerService {

    private get runtimesDir() {
        return path.join(os.homedir(), '.localforge', 'runtimes');
    }

    private get binaryPath(): string {
        const platform = os.platform();
        let binName = 'llama-server';
        if (platform === 'win32') {
            binName = 'llama-server.exe';
        }
        return path.join(this.runtimesDir, binName);
    }

    constructor() {
        if (!fs.existsSync(this.runtimesDir)) {
            fs.mkdirSync(this.runtimesDir, { recursive: true });
        }
    }

    public async getRuntimeInstallStatus(): Promise<RuntimeInstallStatus> {
        const installed = fs.existsSync(this.binaryPath);
        return {
            runtimeId: 'llama.cpp',
            installed,
            statusMessage: installed ? 'Runtime installed and ready.' : 'Runtime not installed.'
        };
    }

    public async installRuntime(runtimeId: 'llama.cpp'): Promise<DownloadTaskStatus> {
        // Returning a simulated task for now, waiting for actual vetted binary manifests.
        const taskId = `rt_dl_${runtimeId}_${Date.now()}`;
        return {
            taskId,
            modelId: runtimeId,
            status: 'failed',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            error: 'Runtime installer not fully configured yet. Missing trusted binary URLs.'
        };
    }

    public async deleteRuntime(runtimeId: 'llama.cpp'): Promise<void> {
        if (fs.existsSync(this.binaryPath)) {
            fs.unlinkSync(this.binaryPath);
        }
    }
}
