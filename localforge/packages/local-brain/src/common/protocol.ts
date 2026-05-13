import { Event } from '@theia/core/lib/common/event';

export const LocalBrainServicePath = '/services/local-brain';
export const LocalBrainChatServicePath = '/services/local-brain-chat';

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

export type RuntimeState = 'not_ready' | 'waiting_for_model' | 'stopped' | 'starting' | 'running' | 'error';

export interface RuntimeStatus {
    installed: boolean;
    state: RuntimeState;
    message: string;
    activeModelId?: string;
    pid?: number;
    port?: number;
}

export interface RuntimeHealth {
    isAlive: boolean;
    status: string;
}

export interface RuntimeLogEntry {
    timestamp: string;
    level: 'info' | 'error' | 'warn';
    message: string;
}

export interface StartRuntimeOptions {
    modelId: string;
    modelPath: string;
    port?: number;
    ctxSize?: number;
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
    fileName?: string;
    sha256?: string;
    license?: string;
    homepageUrl?: string;
    requiresLicenseAcceptance?: boolean;
    notes?: string;
}

export interface InstalledModel {
    id: string;
    manifestId?: string;
    path?: string;
    name?: string;
    isMock?: boolean;
}

export interface DownloadTaskStatus {
    taskId: string;
    modelId: string;
    status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'failed' | 'cancelled';
    progress: number; // 0 to 100
    downloadedBytes: number;
    totalBytes: number;
    speedBytesPerSec?: number;
    error?: string;
}

export interface RuntimeInstallStatus {
    runtimeId: string;
    installed: boolean;
    statusMessage: string;
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

    getRuntimeStatus(): Promise<RuntimeStatus>;
    startRuntime(modelId?: string): Promise<RuntimeStatus>;
    stopRuntime(): Promise<RuntimeStatus>;
    restartRuntime(modelId?: string): Promise<RuntimeStatus>;
    getRuntimeLogs(): Promise<RuntimeLogEntry[]>;

    downloadModel(modelId: string, acceptLicense?: boolean): Promise<DownloadTaskStatus>;
    cancelDownload(taskId: string): Promise<void>;
    getDownloadStatus(taskId: string): Promise<DownloadTaskStatus>;
    listDownloadTasks(): Promise<DownloadTaskStatus[]>;
    deleteInstalledModel(modelId: string): Promise<void>;

    getRuntimeInstallStatus(): Promise<RuntimeInstallStatus>;
    installRuntime(runtimeId: 'llama.cpp'): Promise<DownloadTaskStatus>;
    deleteRuntime(runtimeId: 'llama.cpp'): Promise<void>;
}

// Phase 2D: Chat Interfaces

export interface LocalBrainChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LocalBrainChatRequest {
    sessionId: string;
    messages: LocalBrainChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

export interface LocalBrainChatChunk {
    sessionId: string;
    chunk: string;
    done: boolean;
    error?: string;
}

export const LocalBrainChatService = Symbol('LocalBrainChatService');

export interface LocalBrainChatService {
    readonly onChatChunk: Event<LocalBrainChatChunk>;
    streamChatCompletion(request: LocalBrainChatRequest): Promise<void>;
    cancelGeneration(sessionId: string): Promise<void>;
}

// Phase 3D: AI Codegen Loop
export const AICodegenServicePath = '/services/ai-codegen';

export interface CodegenRequest {
    workspacePath: string;
    appPath: string;
    userPrompt: string;
    targetFiles?: string[];
    mode: 'small-edit' | 'component' | 'page' | 'api-route' | 'bugfix' | 'refactor';
    safetyLevel: 'suggest-only' | 'diff-required';
}

export interface FilePatch {
    path: string;
    action: 'create' | 'modify' | 'delete';
    before?: string;
    after?: string;
}

export interface CommandPatch {
    command: string;
    reason: string;
    requiresApproval: boolean;
}

export interface GeneratedPatch {
    id: string;
    summary: string;
    files: FilePatch[];
    commands?: CommandPatch[];
    risks: string[];
}

export interface CodegenPlan {
    id: string;
    request: CodegenRequest;
    contextGathered: string[];
    status: 'analyzing' | 'generating' | 'ready';
}

export interface ApplyPatchResult {
    success: boolean;
    filesModified: number;
    error?: string;
}

export const AICodegenService = Symbol('AICodegenService');

export interface AICodegenService {
    createEditPlan(input: CodegenRequest): Promise<CodegenPlan>;
    generatePatch(planId: string): Promise<GeneratedPatch>;
    applyPatch(patchId: string): Promise<ApplyPatchResult>;
    rejectPatch(patchId: string): Promise<void>;
    getActivePatch(): Promise<GeneratedPatch | null>;
}
