import { injectable } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { URI } from '@theia/core';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { PreviewService, PreviewStatus, PreviewState, PreviewLogEvent } from '../common/protocol';


@injectable()
export class PreviewServiceImpl implements PreviewService, BackendApplicationContribution {

    private readonly onStateChangeEmitter = new Emitter<PreviewStatus>();
    public readonly onStateChange: Event<PreviewStatus> = this.onStateChangeEmitter.event;

    private readonly onLogEmitter = new Emitter<PreviewLogEvent>();
    public readonly onLog: Event<PreviewLogEvent> = this.onLogEmitter.event;

    private state: PreviewState = 'stopped';
    private url: string | undefined;
    private message: string | undefined;

    private currentProcess: ChildProcess | undefined;
    private isRestarting = false;



    // Hook into IDE shutdown to clean up detached processes
    onStop(): void {
        this.stopPreview().catch(console.error);
    }

    private updateState(state: PreviewState, message?: string, url?: string) {
        this.state = state;
        if (message !== undefined) this.message = message;
        if (url !== undefined) this.url = url;

        this.onStateChangeEmitter.fire({
            state: this.state,
            message: this.message,
            url: this.url
        });
    }

    private emitLog(type: 'stdout' | 'stderr' | 'system', msg: string) {
        this.onLogEmitter.fire({
            type,
            message: msg.trim(),
            timestamp: Date.now()
        });
    }

    public async getStatus(): Promise<PreviewStatus> {
        return {
            state: this.state,
            url: this.url,
            message: this.message
        };
    }

    public async simulateProxyCustomerE2ETest(workspaceRootUriStr: string): Promise<void> {
        // Stub implementation for Phase 6: The Proxy Customer
        this.emitLog('system', 'Starting background Proxy Customer E2E test run...');

        if (this.state !== 'running') {
            this.emitLog('system', '[E2E] Aborted: Live Preview server is not running.');
            return;
        }

        setTimeout(() => {
            this.emitLog('system', '[E2E] Proxy Customer visiting http://localhost:3000/ ...');
        }, 1000);

        setTimeout(() => {
            this.emitLog('system', '[E2E] Proxy Customer navigating to /auth/login ...');
        }, 2500);

        setTimeout(() => {
            this.emitLog('system', '[E2E] Proxy Customer submitting login form...');
            // Simulate a crash/error that the DependencyDoctor will catch
            this.emitLog('stderr', '[E2E] Test failed: Expected element <button id="submit"> to be visible, but it was hidden. Checkout form inaccessible.');
        }, 4000);
    }

    public async startPreview(workspaceRootUriStr: string): Promise<void> {
        if (this.currentProcess) {
            this.emitLog('system', 'Preview already active. Use restart.');
            return;
        }

        const rootUri = new URI(workspaceRootUriStr);
        const rootPath = rootUri.path.toString();
        const appDir = path.join(rootPath, 'apps', 'web');

        if (!fs.existsSync(appDir) || !fs.existsSync(path.join(appDir, 'package.json'))) {
            this.updateState('missing_directory', 'No app found at /apps/web with a package.json.');
            return;
        }

        const pkgManager = fs.existsSync(path.join(appDir, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';

        // 1. Install dependencies if node_modules missing
        if (!fs.existsSync(path.join(appDir, 'node_modules'))) {
            this.updateState('installing_dependencies', `Installing dependencies using ${pkgManager}...`);
            this.emitLog('system', `Installing dependencies using ${pkgManager} install...`);

            try {
                await this.runCommand(pkgManager, ['install'], appDir);
            } catch (err) {
                this.updateState('crashed', `Failed to install dependencies: ${String(err)}`);
                return;
            }
        }

        // 2. Start Dev Server
        this.updateState('starting_server', `Starting dev server with ${pkgManager} run dev...`);
        this.emitLog('system', `Starting server...`);

        try {
            this.currentProcess = spawn(pkgManager, ['run', 'dev'], {
                cwd: appDir,
                detached: true,
                shell: true
            });

            this.currentProcess.stdout?.on('data', (data) => {
                const str = data.toString();
                this.emitLog('stdout', str);

                // Detect local url e.g. "ready - started server on 0.0.0.0:3000, url: http://localhost:3000" or "Local: http://localhost:3000"
                if (this.state === 'starting_server' || this.state === 'waiting_for_localhost') {
                    const match = str.match(/http:\/\/(localhost|127\.0\.0\.1):(\d+)/i);
                    if (match) {
                        const detectedUrl = match[0];
                        this.updateState('running', `Server running at ${detectedUrl}`, detectedUrl);
                        // State updated by events({ workspaceRootUri: new URI(process.cwd()).toString(), phase: 'live-preview' });
                        this.emitLog('system', `Detected dev server URL: ${detectedUrl}`);
                    }
                }
            });

            this.currentProcess.stderr?.on('data', (data) => {
                const str = data.toString();
                this.emitLog('stderr', str);

                // Detect port in use
                if (str.toLowerCase().includes('eaddrinuse') || str.toLowerCase().includes('port is already in use')) {
                    this.updateState('port_unavailable', 'Port already in use. Please stop other servers.');
                }
            });

            this.currentProcess.on('close', (code) => {
                this.currentProcess = undefined;
                if (this.isRestarting) {
                    this.isRestarting = false;
                } else if (this.state !== 'stopped') {
                    this.updateState('crashed', `Process exited with code ${code}`);
                }
            });

            this.currentProcess.on('error', (err) => {
                this.currentProcess = undefined;
                this.emitLog('stderr', `Process error: ${err.message}`);
                this.updateState('crashed', `Failed to start server: ${err.message}`);
            });

            this.updateState('waiting_for_localhost', 'Waiting for server to expose port...');

        } catch (err) {
            this.updateState('crashed', `Exception starting server: ${String(err)}`);
        }
    }

    public async stopPreview(): Promise<void> {
        if (this.currentProcess && this.currentProcess.pid) {
            this.emitLog('system', 'Stopping preview server...');
            try {
                // Kill process group to ensure child processes (like Next.js sub-processes) die
                process.kill(-this.currentProcess.pid, 'SIGKILL');
            } catch (e) {
                try {
                    this.currentProcess.kill('SIGKILL');
                } catch (fallbackErr) {}
            }
        }
        this.currentProcess = undefined;
        this.updateState('stopped', 'Server stopped.');
    }

    public async restartPreview(workspaceRootUriStr: string): Promise<void> {
        this.isRestarting = true;
        await this.stopPreview();
        setTimeout(async () => {
            await this.startPreview(workspaceRootUriStr);
        }, 1000);
    }

    private runCommand(command: string, args: string[], cwd: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, { cwd, shell: true });

            proc.stdout?.on('data', (data) => {
                this.emitLog('stdout', data.toString());
            });
            proc.stderr?.on('data', (data) => {
                this.emitLog('stderr', data.toString());
            });

            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Command exited with code ${code}`));
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });
    }
}
