import { RuntimeStatus, StartRuntimeOptions, RuntimeHealth, RuntimeLogEntry } from '../common/protocol';

export const LocalBrainRuntimeProvider = Symbol('LocalBrainRuntimeProvider');

export interface LocalBrainRuntimeProvider {
    getRuntimeStatus(): Promise<RuntimeStatus>;
    startRuntime(options: StartRuntimeOptions): Promise<RuntimeStatus>;
    stopRuntime(): Promise<RuntimeStatus>;
    restartRuntime(options?: StartRuntimeOptions): Promise<RuntimeStatus>;
    healthCheck(): Promise<RuntimeHealth>;
    getLogs(): Promise<RuntimeLogEntry[]>;
}
