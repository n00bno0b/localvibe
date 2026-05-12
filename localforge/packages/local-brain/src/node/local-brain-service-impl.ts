import { injectable } from '@theia/core/shared/inversify';
import { LocalBrainService, LocalBrainStatus, ModelMode, InstalledModel, ModelModeId } from '../common/protocol';

@injectable()
export class LocalBrainServiceImpl implements LocalBrainService {
    private activeMode: ModelModeId = 'balanced';

    async getStatus(): Promise<LocalBrainStatus> {
        return {
            installed: false, // For now, we simulate a mock state where a real runtime isn't installed
            ready: true, // But our mock is "ready" to respond
            message: 'Mock runtime active (Real runtime not installed)'
        };
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
        return [
            { id: 'mock-fast-model', name: 'Fast Coding Brain', description: 'Mock Fast Model placeholder', isMock: true },
            { id: 'mock-balanced-model', name: 'Balanced Coding Brain', description: 'Mock Balanced Model placeholder', isMock: true }
        ];
    }

    async getActiveMode(): Promise<ModelModeId> {
        return this.activeMode;
    }

    async setActiveMode(mode: ModelModeId): Promise<void> {
        this.activeMode = mode;
        console.log(`[Local Brain Backend] Active mode set to: ${mode}`);
    }
}
