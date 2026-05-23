import { injectable } from '@theia/core/shared/inversify';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { LocalBrainService, RuntimeManifest, LocalBrainStatus, ModelMode, InstalledModel, ModelModeId, MachineProfile, LocalBrainModelManifest, RuntimeStatus, RuntimeLogEntry, DownloadTaskStatus, RuntimeInstallStatus } from '../common/protocol';
import { HardwareDetector } from './hardware-detector';
import { LlamaCppRuntimeProvider } from './llama-cpp-provider';
import { DownloaderService } from './downloader-service';
import { RuntimeInstallerService } from './runtime-installer-service';

@injectable()
export class LocalBrainServiceImpl implements LocalBrainService {
    private activeMode: ModelModeId = 'auto';
    private detector = new HardwareDetector();
    private runtimeProvider = new LlamaCppRuntimeProvider();
    private downloader = new DownloaderService();
    private runtimeInstaller = new RuntimeInstallerService();

    private get modelsDir() {
        return path.join(os.homedir(), '.localforge', 'models');
    }

    async getStatus(): Promise<LocalBrainStatus> {
        const rtStatus = await this.runtimeProvider.getRuntimeStatus();
        const models = await this.listInstalledModels();

        let runtimeReadiness: 'not-installed' | 'ready' | 'error' = 'not-installed';
        if (rtStatus.installed) {
            runtimeReadiness = rtStatus.state === 'error' ? 'error' : 'ready';
        }

        return {
            runtimeReadiness,
            modelReadiness: models.length > 0 ? 'models-available' : 'no-models',
            modelStorageLocation: this.modelsDir,
            message: rtStatus.message
        };
    }

    async getMachineProfile(): Promise<MachineProfile> {
        return await this.detector.detect();
    }

    async getAvailableManifests(): Promise<LocalBrainModelManifest[]> {
        return [
            {
                id: 'localforge-fast-v1',
                displayName: 'Fast Coding Brain (Qwen 1.5B)',
                mode: 'fast',
                provider: 'localforge',
                runtime: 'llama.cpp',
                format: 'gguf',
                quantization: 'Q4_K_M',
                estimatedSizeGB: 1.2,
                minRamGB: 4,
                recommendedRamGB: 8,
                contextLength: 4096,
                fileName: 'qwen-1.5b.gguf',
                downloadUrl: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
                notes: 'Placeholder manifest for fast model'
            },
            {
                id: 'localforge-balanced-v1',
                displayName: 'Balanced Coding Brain (DeepSeek 7B)',
                mode: 'balanced',
                provider: 'localforge',
                runtime: 'llama.cpp',
                format: 'gguf',
                quantization: 'Q4_K_M',
                estimatedSizeGB: 4.5,
                minRamGB: 8,
                recommendedRamGB: 16,
                contextLength: 8192,
                fileName: 'deepseek-7b.gguf',
                notes: 'Placeholder manifest for balanced model',
                requiresLicenseAcceptance: true,
                license: 'Meta Llama 3 Community License',
                homepageUrl: 'https://deepseek.com/'
            },
            {
                id: 'localforge-powerful-v1',
                displayName: 'Powerful Coding Brain (Llama-3 30B)',
                mode: 'powerful',
                provider: 'localforge',
                runtime: 'llama.cpp',
                format: 'gguf',
                quantization: 'Q4_K_M',
                estimatedSizeGB: 18.5,
                minRamGB: 24,
                recommendedRamGB: 32,
                contextLength: 16384,
                fileName: 'llama3-30b.gguf',
                notes: 'Placeholder manifest for powerful model'
            }
        ];
    }

    async listModes(): Promise<ModelMode[]> {
        return [
            { id: 'fast', label: 'Fast', description: 'Optimized for speed (smaller model)' },
            { id: 'balanced', label: 'Balanced', description: 'Good trade-off between speed and quality' },
            { id: 'powerful', label: 'Powerful', description: 'Best quality, requires more VRAM/RAM' },
            { id: 'auto', label: 'Auto', description: 'Automatically select based on system resources' }
        ];
    }

    async listInstalledModels(): Promise<InstalledModel[]> {
        if (!fs.existsSync(this.modelsDir)) {
            return [];
        }
        try {
            const files = fs.readdirSync(this.modelsDir);
            const ggufFiles = files.filter(f => f.endsWith('.gguf'));

            // Map files to manifests if possible
            const manifests = await this.getAvailableManifests();

            return ggufFiles.map(f => {
                const manifest = manifests.find(m => m.fileName === f || m.id + '.gguf' === f);
                return {
                    id: manifest ? manifest.id : f.replace('.gguf', ''),
                    manifestId: manifest ? manifest.id : undefined,
                    name: manifest ? manifest.displayName : f,
                    path: path.join(this.modelsDir, f),
                    isMock: false
                };
            });
        } catch (e) {
            return [];
        }
    }

    async getActiveMode(): Promise<ModelModeId> {
        return this.activeMode;
    }

    async setActiveMode(mode: ModelModeId): Promise<void> {
        this.activeMode = mode;
        console.log(`[Local Brain Backend] Active mode set to: ${mode}`);
    }

    // Phase 2B additions
    async getRuntimeStatus(): Promise<RuntimeStatus> {
        return this.runtimeProvider.getRuntimeStatus();
    }

    async startRuntime(modelId?: string): Promise<RuntimeStatus> {
        const models = await this.listInstalledModels();
        const targetModel = modelId
            ? models.find(m => m.id === modelId)
            : (models.length > 0 ? models[0] : undefined);

        if (!targetModel || !targetModel.path) {
            throw new Error('No installed model available to start the runtime.');
        }

        return this.runtimeProvider.startRuntime({
            modelId: targetModel.id,
            modelPath: targetModel.path,
            port: 8080
        });
    }

    async stopRuntime(): Promise<RuntimeStatus> {
        return this.runtimeProvider.stopRuntime();
    }

    async restartRuntime(modelId?: string): Promise<RuntimeStatus> {
        await this.stopRuntime();
        if (modelId) {
            return this.startRuntime(modelId);
        } else {
            return this.startRuntime();
        }
    }

    async getRuntimeLogs(): Promise<RuntimeLogEntry[]> {
        return this.runtimeProvider.getLogs();
    }

    // Phase 2C additions
    async downloadModel(modelId: string, acceptLicense?: boolean): Promise<DownloadTaskStatus> {
        const manifests = await this.getAvailableManifests();
        const manifest = manifests.find(m => m.id === modelId);
        if (!manifest) {
            throw new Error(`Manifest not found for model: ${modelId}`);
        }
        return this.downloader.downloadModel(manifest, acceptLicense);
    }

    async cancelDownload(taskId: string): Promise<void> {
        return this.downloader.cancel(taskId);
    }

    async getDownloadStatus(taskId: string): Promise<DownloadTaskStatus> {
        const task = this.downloader.getTask(taskId);
        if (!task) throw new Error('Task not found');
        return task;
    }

    async listDownloadTasks(): Promise<DownloadTaskStatus[]> {
        return this.downloader.listTasks();
    }

    async deleteInstalledModel(modelId: string): Promise<void> {
        const models = await this.listInstalledModels();
        const target = models.find(m => m.id === modelId);
        if (target && target.path && fs.existsSync(target.path)) {
            fs.unlinkSync(target.path);

            // Stop runtime if this model was running
            const rtStatus = await this.getRuntimeStatus();
            if (rtStatus.activeModelId === modelId) {
                await this.stopRuntime();
            }
        }
    }

    async listAvailableRuntimes(): Promise<RuntimeManifest[]> {
        return this.runtimeInstaller.listAvailableRuntimes();
    }

    async getRecommendedRuntime(): Promise<RuntimeManifest | undefined> {
        const profile = await this.getMachineProfile();
        return this.runtimeInstaller.getRecommendedRuntime(profile);
    }

    async cancelRuntimeInstall(taskId: string): Promise<void> {
        return this.runtimeInstaller.cancelRuntimeInstall(taskId);
    }

    async getRuntimeInstallStatus(): Promise<RuntimeInstallStatus> {
        return this.runtimeInstaller.getRuntimeInstallStatus();
    }

    async installRuntime(runtimeId: string): Promise<DownloadTaskStatus> {
        return this.runtimeInstaller.installRuntime(runtimeId);
    }

    async deleteRuntime(runtimeId: 'llama.cpp'): Promise<void> {
        await this.stopRuntime();
        return this.runtimeInstaller.deleteRuntime(runtimeId);
    }
}
