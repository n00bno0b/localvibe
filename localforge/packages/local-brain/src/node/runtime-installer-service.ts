import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { injectable } from '@theia/core/shared/inversify';
import { RuntimeInstallStatus, DownloadTaskStatus, RuntimeManifest, MachineProfile, RuntimeInstallerService as IRuntimeInstallerService } from '../common/protocol';

@injectable()
export class RuntimeInstallerService implements IRuntimeInstallerService {

    private tasks: Map<string, DownloadTaskStatus> = new Map();
    private activeRequests: Map<string, any> = new Map();

    private get runtimesDir() {
        return path.join(os.homedir(), '.localforge', 'runtimes');
    }

    private get downloadsDir() {
        return path.join(os.homedir(), '.localforge', 'downloads');
    }

    private get binaryName(): string {
        const platform = os.platform();
        return platform === 'win32' ? 'llama-server.exe' : 'llama-server';
    }

    private get binaryPath(): string {
        return path.join(this.runtimesDir, this.binaryName);
    }

    constructor() {
        if (!fs.existsSync(this.runtimesDir)) {
            fs.mkdirSync(this.runtimesDir, { recursive: true });
        }
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    public async listAvailableRuntimes(): Promise<RuntimeManifest[]> {
        return [
            {
                id: 'llama-cpp-b9291-linux-cpu',
                runtime: 'llama.cpp',
                displayName: 'llama.cpp b9291 (Linux CPU)',
                version: 'b9291',
                platform: 'linux',
                arch: 'x64',
                acceleration: 'cpu',
                binaryName: 'llama-server',
                downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b9291/llama-b9291-bin-ubuntu-x64.tar.gz',
                archiveType: 'tar.gz',
                sha256: '8cb79eb596cc5cc15a6089ceadaa2723e3d75c1e7b37cfb9977ad1d4dc4a41eb',
                sizeBytes: 15000000
            },
            {
                id: 'llama-cpp-b9291-linux-vulkan',
                runtime: 'llama.cpp',
                displayName: 'llama.cpp b9291 (Linux Vulkan/GPU)',
                version: 'b9291',
                platform: 'linux',
                arch: 'x64',
                acceleration: 'vulkan',
                binaryName: 'llama-server',
                downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b9291/llama-b9291-bin-ubuntu-vulkan-x64.tar.gz',
                archiveType: 'tar.gz',
                sha256: '7e3bf4202bedc71c2c9fbfbe02d10075b8d596bb963e7ab006663582dc2e92c2'
            },
            {
                id: 'llama-cpp-b9291-macos-metal',
                runtime: 'llama.cpp',
                displayName: 'llama.cpp b9291 (macOS Metal)',
                version: 'b9291',
                platform: 'darwin',
                arch: 'arm64',
                acceleration: 'metal',
                binaryName: 'llama-server',
                downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b9291/llama-b9291-bin-macos-arm64.tar.gz',
                archiveType: 'tar.gz',
                sha256: '0e985f87dd71f96a9cb9ebc3ad26f8388030342d000e7e82d4a38d14913373ff'
            },
            {
                id: 'llama-cpp-b9291-win-cpu',
                runtime: 'llama.cpp',
                displayName: 'llama.cpp b9291 (Windows CPU)',
                version: 'b9291',
                platform: 'win32',
                arch: 'x64',
                acceleration: 'cpu',
                binaryName: 'llama-server.exe',
                downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b9291/llama-b9291-bin-win-cpu-x64.zip',
                archiveType: 'zip',
                sha256: '6e12800bdf4e7fd35e081641679ab2fb9088c20f33d2fbcd0bda2f5889e27fa2'
            },
            {
                id: 'llama-cpp-b9291-win-cuda',
                runtime: 'llama.cpp',
                displayName: 'llama.cpp b9291 (Windows CUDA)',
                version: 'b9291',
                platform: 'win32',
                arch: 'x64',
                acceleration: 'cuda',
                binaryName: 'llama-server.exe',
                downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b9291/llama-b9291-bin-win-cuda-12.4-x64.zip',
                archiveType: 'zip',
                sha256: '36f88a4ac69e32ca5baf0ca699f087ba66bbfb592dc8703643bd0e9df3e275d7'
            }
        ];
    }

    public async getRecommendedRuntime(profile: MachineProfile): Promise<RuntimeManifest | undefined> {
        const runtimes = await this.listAvailableRuntimes();

        let targetAccel = 'cpu';
        if (profile.gpuAccelerationPossible) {
            if (profile.os === 'win32') targetAccel = 'cuda';
            else if (profile.os === 'linux') targetAccel = 'vulkan'; // Use Vulkan on Linux since generic CUDA builds aren't standard mapped without explicit versions
            else if (profile.os === 'darwin') targetAccel = 'metal';
        }

        const target = runtimes.find(r => r.platform === profile.os && r.arch === profile.arch && r.acceleration === targetAccel);
        if (!target) {
            return runtimes.find(r => r.platform === profile.os && r.arch === profile.arch && r.acceleration === 'cpu');
        }

        return target;
    }

    public async getRuntimeInstallStatus(runtimeId?: string): Promise<RuntimeInstallStatus> {
        const installed = fs.existsSync(this.binaryPath);
        return {
            runtimeId: runtimeId || 'llama.cpp',
            installed,
            statusMessage: installed ? 'Runtime installed and ready.' : 'Runtime not installed.'
        };
    }

    public async cancelRuntimeInstall(taskId: string): Promise<void> {
        const req = this.activeRequests.get(taskId);
        if (req) {
            req.abort();
            this.activeRequests.delete(taskId);
        }
        const task = this.tasks.get(taskId);
        if (task && (task.status === 'downloading' || task.status === 'pending' || task.status === 'verifying')) {
            task.status = 'cancelled';
        }
    }

    public async installRuntime(runtimeId: string): Promise<DownloadTaskStatus> {
        const manifests = await this.listAvailableRuntimes();
        const manifest = manifests.find(m => m.id === runtimeId);

        if (!manifest) {
            throw new Error(`Runtime manifest not found: ${runtimeId}`);
        }

        const taskId = `rt_dl_${manifest.id}_${Date.now()}`;
        const task: DownloadTaskStatus = {
            taskId,
            modelId: manifest.id,
            status: 'pending',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0
        };

        this.tasks.set(taskId, task);

        this.doInstall(taskId, manifest).catch(err => {
            task.status = 'failed';
            task.error = String(err);
        });

        return task;
    }

    private async doInstall(taskId: string, manifest: RuntimeManifest): Promise<void> {
        const task = this.tasks.get(taskId)!;

        const archiveExt = manifest.archiveType === 'tar.gz' ? '.tar.gz' : '.zip';
        const tempArchive = path.join(this.downloadsDir, `${taskId}${archiveExt}`);
        const extractDir = path.join(this.downloadsDir, `${taskId}_extract`);

        task.status = 'downloading';

        try {
            await this.downloadFile(manifest.downloadUrl, tempArchive, task, manifest.sha256);
            if (this.tasks.get(task.taskId)?.status === 'cancelled') return;

            task.status = 'verifying'; // Actually "Extracting" mapped to verifying in the protocol enum for simplicity, or we can use the message.

            // Extract safely using child_process.spawn array args, no shell interpolation
            if (!fs.existsSync(extractDir)) {
                fs.mkdirSync(extractDir, { recursive: true });
            }

            if (manifest.archiveType === 'zip') {
                await this.runCommand('unzip', ['-o', tempArchive, '-d', extractDir]);
            } else {
                await this.runCommand('tar', ['-xzf', tempArchive, '-C', extractDir]);
            }

            // Locate the binary
            const foundBinary = this.findFileRecursively(extractDir, manifest.binaryName);
            if (!foundBinary) {
                throw new Error(`Binary ${manifest.binaryName} not found in archive.`);
            }

            // Move atomically
            fs.renameSync(foundBinary, this.binaryPath);
            fs.chmodSync(this.binaryPath, 0o755); // make executable

            task.status = 'completed';
            task.progress = 100;
        } catch (e) {
            task.status = 'failed';
            task.error = String(e);
        } finally {
            this.activeRequests.delete(taskId);
            if (fs.existsSync(tempArchive)) fs.unlinkSync(tempArchive);
            if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        }
    }

    private downloadFile(url: string, dest: string, task: DownloadTaskStatus, expectedHash?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    const redirectReq = https.get(res.headers.location!, (redirRes) => {
                        this.processResponse(redirRes, dest, task, expectedHash, resolve, reject);
                    });
                    this.activeRequests.set(task.taskId, redirectReq);
                    redirectReq.on('error', reject);
                    return;
                }
                this.processResponse(res, dest, task, expectedHash, resolve, reject);
            });
            this.activeRequests.set(task.taskId, req);
            req.on('error', reject);
        });
    }

    private processResponse(res: any, dest: string, task: DownloadTaskStatus, expectedHash: string | undefined, resolve: any, reject: any) {
        if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download, status code: ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        task.totalBytes = totalBytes;

        const file = fs.createWriteStream(dest);
        const hash = crypto.createHash('sha256');

        res.on('data', (chunk: Buffer) => {
            if (this.tasks.get(task.taskId)?.status === 'cancelled') {
                res.destroy();
                return;
            }
            task.downloadedBytes += chunk.length;
            if (totalBytes > 0) {
                task.progress = Math.round((task.downloadedBytes / totalBytes) * 100);
            }
            file.write(chunk);
            hash.update(chunk);
        });

        res.on('end', () => {
            file.end();
            if (this.tasks.get(task.taskId)?.status === 'cancelled') return resolve();

            task.status = 'verifying';
            const fileHash = hash.digest('hex');

            if (expectedHash && expectedHash !== 'PLACEHOLDER_HASH' && expectedHash !== fileHash) {
                return reject(new Error(`Checksum mismatch. Expected ${expectedHash}, got ${fileHash}`));
            }

            resolve();
        });

        res.on('error', (err: any) => {
            file.end();
            reject(err);
        });
    }

    private runCommand(command: string, args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            // shell: false prevents shell interpolation vulnerabilities
            const proc = spawn(command, args, { shell: false });
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Command ${command} exited with code ${code}`));
            });
            proc.on('error', reject);
        });
    }

    private findFileRecursively(dir: string, filename: string): string | null {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = this.findFileRecursively(fullPath, filename);
                if (found) return found;
            } else if (file === filename) {
                return fullPath;
            }
        }
        return null;
    }

    public async deleteRuntime(runtimeId: string): Promise<void> {
        if (fs.existsSync(this.binaryPath)) {
            fs.unlinkSync(this.binaryPath);
        }
    }
}
