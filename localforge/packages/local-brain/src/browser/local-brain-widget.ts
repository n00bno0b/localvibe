import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { LocalBrainService } from '../common/protocol';

export const LocalBrainWidgetOptions = {
    id: 'local-brain-widget',
    label: 'Local Brain'
};

@injectable()
export class LocalBrainWidget extends BaseWidget {

    @inject(LocalBrainService)
    protected readonly localBrainService!: LocalBrainService;

    private container: HTMLDivElement;
    private refreshInterval: any;

    constructor() {
        super();
        this.id = LocalBrainWidgetOptions.id;
        this.title.label = LocalBrainWidgetOptions.label;
        this.title.caption = LocalBrainWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-brain';
        this.addClass('local-brain-widget');

        this.container = document.createElement('div');
        this.container.style.padding = '15px';
        this.container.style.overflowY = 'auto';
        this.container.style.height = '100%';

        this.node.appendChild(this.container);
        this.node.style.display = 'flex';
        this.node.style.flexDirection = 'column';
    }

    @postConstruct()
    protected async init(): Promise<void> {
        await this.updateContent();
        this.refreshInterval = setInterval(() => this.updateContent(), 3000);
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.updateContent();
    }

    public override dispose(): void {
        clearInterval(this.refreshInterval);
        super.dispose();
    }

    public async updateContent(): Promise<void> {
        try {
            const rtStatus = await this.localBrainService.getRuntimeStatus();
            const status = await this.localBrainService.getStatus();
            const profile = await this.localBrainService.getMachineProfile();
            const installedModels = await this.localBrainService.listInstalledModels();
            const logs = await this.localBrainService.getRuntimeLogs();

            let activeModeLabel: string = await this.localBrainService.getActiveMode();
            if (activeModeLabel === 'auto') {
                activeModeLabel = `Auto (${profile.recommendedMode})`;
            }

            const canStart = rtStatus.installed && installedModels.length > 0 && (rtStatus.state === 'stopped' || rtStatus.state === 'not_ready');
            const canStop = rtStatus.state === 'running' || rtStatus.state === 'starting';
            const canRestart = canStop; // Can only restart if running or starting

            const logsHtml = logs.length === 0
                ? '<div style="color: #888;">No logs available</div>'
                : `<div style="background: rgba(0,0,0,0.3); padding: 5px; font-family: monospace; font-size: 10px; max-height: 150px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1);">
                    ${logs.map(l => {
                        const color = l.level === 'error' ? 'red' : l.level === 'warn' ? 'yellow' : '#ccc';
                        const escapedMessage = l.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); return `<div style="color: ${color}; white-space: pre-wrap;">[${l.level}] ${escapedMessage}</div>`;
                    }).reverse().join('')}
                   </div>`;

            this.container.innerHTML = `
                <h2 style="margin-top: 0; display: flex; justify-content: space-between; align-items: center;">
                    Local Brain
                    <button id="lb-refresh" style="font-size: 10px; padding: 2px 6px;">Force Refresh</button>
                </h2>

                <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">Runtime Control</h3>
                    <div style="font-size: 12px; margin-bottom: 10px;">
                        <div><strong>State:</strong> <span style="color: ${rtStatus.state === 'running' ? '#4CAF50' : rtStatus.state === 'error' ? 'red' : 'cyan'};">${rtStatus.state.toUpperCase()}</span></div>
                        <div><strong>Installed:</strong> ${rtStatus.installed ? 'Yes' : 'No'}</div>
                        <div><strong>Active Model:</strong> ${rtStatus.activeModelId || 'None'}</div>
                        ${rtStatus.pid ? `<div><strong>PID:</strong> ${rtStatus.pid} (Port: ${rtStatus.port})</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button id="lb-start" ${canStart ? '' : 'disabled'} style="padding: 4px 10px;">Start</button>
                        <button id="lb-stop" ${canStop ? '' : 'disabled'} style="padding: 4px 10px;">Stop</button>
                        <button id="lb-restart" ${canRestart ? '' : 'disabled'} style="padding: 4px 10px;">Restart</button>
                    </div>
                    ${logsHtml}
                </div>

                <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">System & Readiness</h3>
                    <div style="font-size: 12px; color: #ccc;">
                        <div><strong>Mode:</strong> <span style="color: cyan;">${activeModeLabel}</span></div>
                        <div><strong>OS:</strong> ${profile.os} (${profile.arch})</div>
                        <div><strong>RAM:</strong> ${profile.totalRamGB.toFixed(1)} GB Total (${profile.freeRamGB.toFixed(1)} GB Free)</div>
                        <div><strong>GPU:</strong> ${profile.gpuDetected}</div>
                        <div><strong>Storage:</strong> ${status.modelStorageLocation}</div>
                        ${!rtStatus.installed ? `<div style="margin-top: 5px; color: #FF9800;">Action Required: Install Local Brain Runtime (Coming Phase 2C)</div>` : ''}
                    </div>
                </div>
            `;

            // Attach event listeners safely
            const attach = (id: string, cb: () => void) => {
                const el = this.container.querySelector(`#${id}`);
                if (el) { el.addEventListener('click', cb); }
            };

            attach('lb-refresh', () => this.updateContent());
            attach('lb-start', async () => {
                try {
                    await this.localBrainService.startRuntime();
                    this.updateContent();
                } catch (err) {
                    alert(`Failed to start: ${String(err)}`);
                }
            });
            attach('lb-stop', async () => {
                await this.localBrainService.stopRuntime();
                this.updateContent();
            });
            attach('lb-restart', async () => {
                try {
                    await this.localBrainService.restartRuntime();
                    this.updateContent();
                } catch (err) {
                    alert(`Failed to restart: ${String(err)}`);
                }
            });

        } catch (e) {
            this.container.innerHTML = `<div style="color: red;">Error loading Local Brain status: ${String(e)}</div>
            <button id="lb-refresh-err" style="margin-top: 10px;">Retry</button>`;
            const retry = this.container.querySelector('#lb-refresh-err');
            if (retry) { retry.addEventListener('click', () => this.updateContent()); }
        }
    }
}
