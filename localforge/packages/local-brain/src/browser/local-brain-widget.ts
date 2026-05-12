import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { LocalBrainService, LocalBrainModelManifest } from '../common/protocol';

export const LocalBrainWidgetOptions = {
    id: 'local-brain-widget',
    label: 'Local Brain'
};

@injectable()
export class LocalBrainWidget extends BaseWidget {

    @inject(LocalBrainService)
    protected readonly localBrainService!: LocalBrainService;

    private container: HTMLDivElement;
    private refreshButton: HTMLButtonElement;

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

        this.refreshButton = document.createElement('button');
        this.refreshButton.innerText = 'Refresh Status';
        this.refreshButton.style.marginTop = '15px';
        this.refreshButton.style.padding = '5px 10px';
        this.refreshButton.onclick = () => this.updateContent();

        this.node.appendChild(this.container);
        this.node.style.display = 'flex';
        this.node.style.flexDirection = 'column';
    }

    @postConstruct()
    protected async init(): Promise<void> {
        await this.updateContent();
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.updateContent();
    }

    public async updateContent(): Promise<void> {
        try {
            const status = await this.localBrainService.getStatus();
            const profile = await this.localBrainService.getMachineProfile();
            const activeMode = await this.localBrainService.getActiveMode();
            const manifests = await this.localBrainService.getAvailableManifests();
            const installedModels = await this.localBrainService.listInstalledModels();

            let activeModeLabel: string = activeMode;
            if (activeMode === 'auto') {
                activeModeLabel = `Auto (${profile.recommendedMode})`;
            }

            const modelListHtml = installedModels.length === 0
                ? '<div style="color: #888;">No models installed</div>'
                : `<ul>${installedModels.map(m => `<li>${m.id}</li>`).join('')}</ul>`;

            const manifestsHtml = manifests.map((m: LocalBrainModelManifest) => `
                <div style="background: rgba(255,255,255,0.05); padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                    <strong>${m.displayName}</strong> (${m.mode})<br/>
                    <small>Size: ~${m.estimatedSizeGB}GB | RAM Req: ${m.minRamGB}GB+</small>
                </div>
            `).join('');

            const diskSpaceStr = profile.freeDiskSpaceGB !== undefined
                ? `${profile.freeDiskSpaceGB.toFixed(1)} GB free`
                : 'Unknown';

            this.container.innerHTML = `
                <h2 style="margin-top: 0;">Local Brain</h2>

                <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">System Profile</h3>
                    <div style="font-size: 12px; color: #ccc;">
                        <div><strong>OS:</strong> ${profile.os} (${profile.arch})</div>
                        <div><strong>RAM:</strong> ${profile.totalRamGB.toFixed(1)} GB Total (${profile.freeRamGB.toFixed(1)} GB Free)</div>
                        <div><strong>GPU:</strong> ${profile.gpuDetected} ${profile.gpuAccelerationPossible ? '<span style="color: #4CAF50;">[Acceleration Supported]</span>' : ''}</div>
                        <div><strong>Disk:</strong> ${diskSpaceStr}</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">Readiness</h3>
                    <div style="font-size: 12px;">
                        <div style="margin-bottom: 4px;">
                            <strong>Runtime:</strong>
                            <span style="color: ${status.runtimeReadiness === 'not-installed' ? '#FF9800' : '#4CAF50'};">${status.runtimeReadiness}</span>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Models:</strong>
                            <span style="color: ${status.modelReadiness === 'no-models' ? '#FF9800' : '#4CAF50'};">${status.modelReadiness}</span>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Storage:</strong> <span style="word-break: break-all; color: #888;">${status.modelStorageLocation}</span>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Active Mode:</strong> <span style="color: cyan;">${activeModeLabel}</span>
                        </div>
                        <div style="margin-top: 10px; color: cyan;">
                            <strong>Next Step:</strong> <a href="#" onclick="return false;" style="color: cyan; text-decoration: underline;">Install Local Brain Runtime (Coming Soon)</a>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">Available Model Manifests</h3>
                    <div style="font-size: 12px;">
                        ${manifestsHtml}
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">Installed Models</h3>
                    <div style="font-size: 12px;">
                        ${modelListHtml}
                    </div>
                </div>
            `;
            this.container.appendChild(this.refreshButton);

        } catch (e) {
            this.container.innerHTML = `<div style="color: red;">Error loading Local Brain status: ${String(e)}</div>`;
            this.container.appendChild(this.refreshButton);
        }
    }
}
