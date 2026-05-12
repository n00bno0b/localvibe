export const LocalBrainServicePath = '/services/local-brain';

export interface LocalBrainStatus {
    installed: boolean;
    ready: boolean;
    message: string;
}

export type ModelModeId = 'fast' | 'balanced' | 'powerful' | 'auto';

export interface ModelMode {
    id: ModelModeId;
    label: string;
    description: string;
}

export interface InstalledModel {
    id: string;
    name: string;
    description: string;
    isMock: boolean;
}

export const LocalBrainService = Symbol('LocalBrainService');

export interface LocalBrainService {
    getStatus(): Promise<LocalBrainStatus>;
    listModes(): Promise<ModelMode[]>;
    listInstalledModels(): Promise<InstalledModel[]>;
    getActiveMode(): Promise<ModelModeId>;
    setActiveMode(mode: ModelModeId): Promise<void>;
}
