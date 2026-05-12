import { injectable } from '@theia/core/shared/inversify';
import * as path from 'path';
import * as os from 'os';
import { LocalBrainService, LocalBrainStatus, ModelMode, InstalledModel, ModelModeId, MachineProfile, LocalBrainModelManifest } from '../common/protocol';
import { HardwareDetector } from './hardware-detector';

@injectable()
export class LocalBrainServiceImpl implements LocalBrainService {
    private activeMode: ModelModeId = 'auto';
    private detector = new HardwareDetector();

    async getStatus(): Promise<LocalBrainStatus> {
        return {
            runtimeReadiness: 'not-installed',
            modelReadiness: 'no-models',
            modelStorageLocation: path.join(os.homedir(), '.localforge', 'models'),
            message: 'Awaiting runtime installation.'
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
        return [];
    }

    async getActiveMode(): Promise<ModelModeId> {
        return this.activeMode;
    }

    async setActiveMode(mode: ModelModeId): Promise<void> {
        this.activeMode = mode;
        console.log(`[Local Brain Backend] Active mode set to: ${mode}`);
    }
}
