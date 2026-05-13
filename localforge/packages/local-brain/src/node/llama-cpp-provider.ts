import { injectable } from '@theia/core/shared/inversify';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LocalBrainRuntimeProvider } from './runtime-provider';
import { RuntimeStatus, StartRuntimeOptions, RuntimeHealth, RuntimeLogEntry, RuntimeState } from '../common/protocol';

@injectable()
export class LlamaCppRuntimeProvider implements LocalBrainRuntimeProvider {
    private process: ChildProcess | undefined;
    private state: RuntimeState = 'not_ready';
    private activeModelId?: string;
    private port = 8080;
    private logs: RuntimeLogEntry[] = [];
    private readonly MAX_LOGS = 200;

    private get binaryPath(): string {
        const platform = os.platform();
        let binName = 'llama-server';
        if (platform === 'win32') {
            binName = 'llama-server.exe';
        }
        return path.join(os.homedir(), '.localforge', 'runtimes', binName);
    }

    private isInstalled(): boolean {
        return fs.existsSync(this.binaryPath);
    }

    private log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
        this.logs.push({
            timestamp: new Date().toISOString(),
            level,
            message: message.trim()
        });
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift();
        }
    }

    async getRuntimeStatus(): Promise<RuntimeStatus> {
        const installed = this.isInstalled();

        if (!installed) {
            this.state = 'not_ready';
            return {
                installed,
                state: this.state,
                message: 'Recommended next step: Install runtime'
            };
        }

        if (this.state === 'not_ready') {
            this.state = 'stopped';
        }

        return {
            installed,
            state: this.state,
            message: this.state === 'running' ? 'Runtime is active' : 'Ready to start',
            activeModelId: this.activeModelId,
            pid: this.process?.pid,
            port: this.state === 'running' ? this.port : undefined
        };
    }

    async startRuntime(options: StartRuntimeOptions): Promise<RuntimeStatus> {
        if (!this.isInstalled()) {
            throw new Error('Llama.cpp runtime is not installed');
        }

        if (this.state === 'running' || this.state === 'starting') {
            return this.getRuntimeStatus();
        }

        if (!fs.existsSync(options.modelPath)) {
            this.state = 'waiting_for_model';
            throw new Error(`Model not found at path: ${options.modelPath}`);
        }

        this.state = 'starting';
        this.activeModelId = options.modelId;
        this.port = options.port || 8080;
        this.log(`Starting llama-server with model ${options.modelId} on port ${this.port}`);

        const args = [
            '-m', options.modelPath,
            '--host', '127.0.0.1',
            '--port', this.port.toString()
        ];

        if (options.ctxSize) {
            args.push('--ctx-size', options.ctxSize.toString());
        }

        try {
            this.process = spawn(this.binaryPath, args, { stdio: 'pipe' });

            this.process.stdout?.on('data', (data) => {
                this.log(data.toString(), 'info');
                // Basic detection for server ready
                if (data.toString().includes('HTTP server listening')) {
                    this.state = 'running';
                }
            });

            this.process.stderr?.on('data', (data) => {
                this.log(data.toString(), 'error');
            });

            this.process.on('close', (code) => {
                this.log(`llama-server process exited with code ${code}`, 'warn');
                this.state = 'stopped';
                this.process = undefined;
            });

            this.process.on('error', (err) => {
                this.log(`Failed to start process: ${err.message}`, 'error');
                this.state = 'error';
                this.process = undefined;
            });

            // We immediately return a status indicating it's starting.
            // The stdout listener will transition to 'running'.
            return this.getRuntimeStatus();
        } catch (e) {
            this.state = 'error';
            this.log(`Exception during spawn: ${String(e)}`, 'error');
            throw e;
        }
    }

    async stopRuntime(): Promise<RuntimeStatus> {
        if (this.process && !this.process.killed) {
            this.log('Stopping llama-server process...');
            this.process.kill('SIGTERM');
            this.state = 'stopped';
            this.process = undefined;
        } else {
            this.state = 'stopped';
        }
        return this.getRuntimeStatus();
    }

    async restartRuntime(options?: StartRuntimeOptions): Promise<RuntimeStatus> {
        await this.stopRuntime();
        if (options) {
            return this.startRuntime(options);
        } else if (this.activeModelId) {
            // Ideally we'd persist the modelPath too, for now if options missing, we assume failure
            // unless we store the last known options.
            this.log('Restart requested without options, stopping only.', 'warn');
        }
        return this.getRuntimeStatus();
    }

    async healthCheck(): Promise<RuntimeHealth> {
        if (this.state !== 'running') {
            return { isAlive: false, status: 'not running' };
        }
        // In the future: ping http://127.0.0.1:${this.port}/health
        return { isAlive: true, status: 'running' };
    }

    async getLogs(): Promise<RuntimeLogEntry[]> {
        return this.logs;
    }
}
