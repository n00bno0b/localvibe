import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as https from 'https';
import { injectable } from '@theia/core/shared/inversify';
import { DownloadTaskStatus, LocalBrainModelManifest } from '../common/protocol';

@injectable()
export class DownloaderService {
    private tasks: Map<string, DownloadTaskStatus> = new Map();
    private activeRequests: Map<string, any> = new Map();

    private get downloadsDir() {
        return path.join(os.homedir(), '.localforge', 'downloads');
    }

    private get modelsDir() {
        return path.join(os.homedir(), '.localforge', 'models');
    }

    constructor() {
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
        if (!fs.existsSync(this.modelsDir)) {
            fs.mkdirSync(this.modelsDir, { recursive: true });
        }
    }

    public getTask(taskId: string): DownloadTaskStatus | undefined {
        return this.tasks.get(taskId);
    }

    public listTasks(): DownloadTaskStatus[] {
        return Array.from(this.tasks.values());
    }

    public async cancel(taskId: string): Promise<void> {
        const req = this.activeRequests.get(taskId);
        if (req) {
            req.abort();
            this.activeRequests.delete(taskId);
        }
        const task = this.tasks.get(taskId);
        if (task && (task.status === 'downloading' || task.status === 'pending')) {
            task.status = 'cancelled';
        }
    }

    public async downloadModel(manifest: LocalBrainModelManifest, acceptLicense: boolean = false): Promise<DownloadTaskStatus> {
        const taskId = `dl_${manifest.id}_${Date.now()}`;
        const task: DownloadTaskStatus = {
            taskId,
            modelId: manifest.id,
            status: 'pending',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0
        };

        if (manifest.requiresLicenseAcceptance && !acceptLicense) {
            task.status = 'failed';
            task.error = `Download blocked. You must accept the license for this model first.`;
            // Keep task temporarily so UI shows failure
            this.tasks.set(taskId, task);
            return task;
        }

        this.tasks.set(taskId, task);

        // Don't await the actual download so we can return the status immediately
        this.doDownload(taskId, manifest).catch(err => {
            task.status = 'failed';
            task.error = String(err);
        });

        return task;
    }

    private async doDownload(taskId: string, manifest: LocalBrainModelManifest): Promise<void> {
        const task = this.tasks.get(taskId)!;
        if (!manifest.downloadUrl) {
            throw new Error('No download URL provided in manifest');
        }

        const fileName = manifest.fileName || `${manifest.id}.gguf`;
        const tempPath = path.join(this.downloadsDir, `${taskId}.tmp`);
        const finalPath = path.join(this.modelsDir, fileName);

        task.status = 'downloading';

        return new Promise((resolve, reject) => {
            const req = https.get(manifest.downloadUrl!, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    // Very simple redirect logic for github releases/etc
                    const redirectReq = https.get(res.headers.location!, (redirRes) => {
                        this.processResponse(taskId, manifest, redirRes, tempPath, finalPath, resolve, reject);
                    });
                    this.activeRequests.set(taskId, redirectReq);
                    redirectReq.on('error', reject);
                    return;
                }
                this.processResponse(taskId, manifest, res, tempPath, finalPath, resolve, reject);
            });
            this.activeRequests.set(taskId, req);
            req.on('error', reject);
        });
    }

    private processResponse(taskId: string, manifest: LocalBrainModelManifest, res: any, tempPath: string, finalPath: string, resolve: any, reject: any) {
        const task = this.tasks.get(taskId)!;

        if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download, status code: ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        task.totalBytes = totalBytes;

        const file = fs.createWriteStream(tempPath);
        const hash = crypto.createHash('sha256');

        res.on('data', (chunk: Buffer) => {
            if (task.status === 'cancelled') {
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
            if (task.status === 'cancelled') {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return resolve();
            }

            task.status = 'verifying';
            const fileHash = hash.digest('hex');

            if (manifest.sha256 && manifest.sha256 !== fileHash) {
                task.status = 'failed';
                task.error = `Checksum mismatch. Expected ${manifest.sha256}, got ${fileHash}`;
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return reject(new Error(task.error));
            }

            // Atomic rename
            fs.renameSync(tempPath, finalPath);
            task.status = 'completed';
            task.progress = 100;
            this.activeRequests.delete(taskId);
            resolve();
        });

        res.on('error', (err: any) => {
            file.end();
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            reject(err);
        });
    }
}
