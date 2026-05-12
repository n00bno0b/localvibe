export const LocalBrainServicePath = '/services/local-brain';

export interface MachineProfile {
    os: string;
    arch: string;
    totalRamGB: number;
    freeRamGB: number;
    gpuDetected: string;
    gpuAccelerationPossible: boolean;
    freeDiskSpaceGB?: number;
    recommendedMode: ModelModeId;
}

export interface LocalBrainStatus {
    runtimeReadiness: 'not-installed' | 'ready' | 'error';
    modelReadiness: 'no-models' | 'models-available';
    modelStorageLocation: string;
    message: string;
}

export type ModelModeId = 'fast' | 'balanced' | 'powerful' | 'auto';

export interface ModelMode {
    id: ModelModeId;
    label: string;
    description: string;
}

export interface LocalBrainModelManifest {
    id: string;
    displayName: string;
    mode: 'fast' | 'balanced' | 'powerful';
    provider: 'localforge';
    runtime: 'llama.cpp';
    format: 'gguf';
    quantization: string;
    estimatedSizeGB: number;
    minRamGB: number;
    recommendedRamGB: number;
    minVramGB?: number;
    recommendedVramGB?: number;
    contextLength: number;
    downloadUrl?: string;
    sha256?: string;
    license?: string;
    notes?: string;
}

export interface InstalledModel {
    id: string;
    manifestId?: string;
    path?: string;
    name?: string;
    isMock?: boolean;
}

export const LocalBrainService = Symbol('LocalBrainService');

export interface LocalBrainService {
    getStatus(): Promise<LocalBrainStatus>;
    getMachineProfile(): Promise<MachineProfile>;
    listModes(): Promise<ModelMode[]>;
    getAvailableManifests(): Promise<LocalBrainModelManifest[]>;
    listInstalledModels(): Promise<InstalledModel[]>;
    getActiveMode(): Promise<ModelModeId>;
    setActiveMode(mode: ModelModeId): Promise<void>;
}
