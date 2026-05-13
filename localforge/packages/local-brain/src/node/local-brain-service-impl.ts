import { injectable } from '@theia/core/shared/inversify';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { LocalBrainService, LocalBrainStatus, ModelMode, InstalledModel, ModelModeId, MachineProfile, LocalBrainModelManifest, RuntimeStatus, RuntimeLogEntry } from '../common/protocol';
import { HardwareDetector } from './hardware-detector';
import { LlamaCppRuntimeProvider } from './llama-cpp-provider';

@injectable()
export class LocalBrainServiceImpl implements LocalBrainService {
    private activeMode: ModelModeId = 'auto';
    private detector = new HardwareDetector();
    private runtimeProvider = new LlamaCppRuntimeProvider();

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
            modelStorageLocation: path.join(os.homedir(), '.localforge', 'models'),
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
                notes: 'Placeholder manifest for balanced model'
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
        const modelsPath = path.join(os.homedir(), '.localforge', 'models');
        if (!fs.existsSync(modelsPath)) {
            return [];
        }
        try {
            const files = fs.readdirSync(modelsPath);
            const ggufFiles = files.filter(f => f.endsWith('.gguf'));
            return ggufFiles.map(f => ({
                id: f.replace('.gguf', ''),
                name: f,
                path: path.join(modelsPath, f)
            }));
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
        // If no modelId is provided, attempt to pick the first available
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
            // Attempt to start whatever was previously running or default
            return this.startRuntime();
        }
    }

    async getRuntimeLogs(): Promise<RuntimeLogEntry[]> {
        return this.runtimeProvider.getLogs();
    }
}
