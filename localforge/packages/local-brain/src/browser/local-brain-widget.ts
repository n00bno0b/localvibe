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
        this.refreshInterval = setInterval(() => this.updateContent(), 2000); // Poll a bit faster for download progress
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
            const manifests = await this.localBrainService.getAvailableManifests();
            const installedModels = await this.localBrainService.listInstalledModels();
            const logs = await this.localBrainService.getRuntimeLogs();
            const downloads = await this.localBrainService.listDownloadTasks();
            const rtInstallStatus = await this.localBrainService.getRuntimeInstallStatus();

            let activeModeLabel: string = await this.localBrainService.getActiveMode();
            if (activeModeLabel === 'auto') {
                activeModeLabel = `Auto (${profile.recommendedMode})`;
            }

            const canStart = rtStatus.installed && installedModels.length > 0 && (rtStatus.state === 'stopped' || rtStatus.state === 'not_ready');
            const canStop = rtStatus.state === 'running' || rtStatus.state === 'starting';
            const canRestart = canStop;

            const logsHtml = logs.length === 0
                ? '<div style="color: #888;">No logs available</div>'
                : `<div style="background: rgba(0,0,0,0.3); padding: 5px; font-family: monospace; font-size: 10px; max-height: 150px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1);">
                    ${logs.map(l => {
                        const color = l.level === 'error' ? 'red' : l.level === 'warn' ? 'yellow' : '#ccc';
                        const escapedMessage = l.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        return `<div style="color: ${color}; white-space: pre-wrap;">[${l.level}] ${escapedMessage}</div>`;
                    }).reverse().join('')}
                   </div>`;

            const activeDownloadsHtml = downloads.filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'verifying').map(d => {
                const isDl = d.status === 'downloading';
                const speed = isDl && d.speedBytesPerSec ? ` (${(d.speedBytesPerSec / (1024*1024)).toFixed(1)} MB/s)` : '';
                return `
                <div style="background: rgba(0, 150, 255, 0.1); padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid rgba(0, 150, 255, 0.3);">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Downloading ${d.modelId}</strong>
                        <button class="lb-cancel-dl" data-taskid="${d.taskId}" style="font-size: 10px; padding: 2px 5px;">Cancel</button>
                    </div>
                    <div style="margin-top: 5px;">Status: ${d.status}${speed}</div>
                    <div style="width: 100%; background: #333; height: 10px; border-radius: 5px; margin-top: 5px; overflow: hidden;">
                        <div style="width: ${d.progress}%; background: #4CAF50; height: 100%;"></div>
                    </div>
                    <div style="font-size: 10px; text-align: right; margin-top: 2px;">${d.progress}%</div>
                </div>`;
            }).join('');

            const failedDownloadsHtml = downloads.filter(d => d.status === 'failed').map(d => {
                return `
                <div style="background: rgba(255, 0, 0, 0.1); padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid rgba(255, 0, 0, 0.3);">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Failed: ${d.modelId}</strong>
                        <button class="lb-cancel-dl" data-taskid="${d.taskId}" style="font-size: 10px; padding: 2px 5px;">Dismiss</button>
                    </div>
                    <div style="margin-top: 5px; color: #ff5555; font-size: 10px;">Error: ${d.error || 'Unknown error'}</div>
                </div>`;
            }).join('');

            const modelListHtml = installedModels.length === 0
                ? '<div style="color: #888;">No models installed</div>'
                : `<ul style="padding-left: 20px; margin: 0;">${installedModels.map(m => `
                    <li style="margin-bottom: 5px;">
                        ${m.name}
                        <button class="lb-del-model" data-modelid="${m.id}" style="font-size: 10px; padding: 2px 5px; color: #ff5555;">Delete</button>
                    </li>
                  `).join('')}</ul>`;

            const manifestsHtml = manifests.map(m => {
                const isInstalled = installedModels.some(im => im.manifestId === m.id || im.name === m.fileName);
                const isDownloading = downloads.some(d => d.modelId === m.id && (d.status === 'downloading' || d.status === 'pending' || d.status === 'verifying'));

                let btnHtml = '';
                if (isInstalled) {
                    btnHtml = `<span style="color: #4CAF50; font-size: 10px;">Installed</span>`;
                } else if (isDownloading) {
                    btnHtml = `<span style="color: cyan; font-size: 10px;">Downloading...</span>`;
                } else if (m.downloadUrl) {
                    let onClickAttr = `class="lb-download" data-modelid="${m.id}"`;
                    if (m.requiresLicenseAcceptance) {
                        const licenseText = (m.license || 'Proprietary').replace(/"/g, '&quot;');
                        const homepageUrl = m.homepageUrl ? m.homepageUrl.replace(/"/g, '&quot;') : '';
                        onClickAttr = `class="lb-download-license" data-modelid="${m.id}" data-license="${licenseText}" data-homepage="${homepageUrl}"`;
                    }
                    btnHtml = `<button ${onClickAttr} style="font-size: 10px; padding: 2px 6px;">Download</button>`;
                } else {
                    btnHtml = `<span style="color: #888; font-size: 10px;">No URL</span>`;
                }

                return `
                <div style="background: rgba(255,255,255,0.05); padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong>${m.displayName}</strong>
                        ${btnHtml}
                    </div>
                    <small style="color: #ccc;">Tier: ${m.mode} | Size: ~${m.estimatedSizeGB}GB | RAM Req: ${m.minRamGB}GB+</small>
                    ${m.requiresLicenseAcceptance ? `<br><small style="color: #FF9800;">Requires License Acceptance</small>` : ''}
                </div>
            `}).join('');

            let installRtHtml = '';
            if (!rtInstallStatus.installed) {
                installRtHtml = `
                    <div style="margin-top: 10px; background: rgba(255, 152, 0, 0.1); padding: 10px; border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 4px;">
                        <div style="color: #FF9800; margin-bottom: 5px;"><strong>Action Required:</strong> ${rtInstallStatus.statusMessage}</div>
                        <button id="lb-install-rt" style="padding: 4px 10px;">Install Local Brain Runtime</button>
                    </div>
                `;
            } else {
                 installRtHtml = `
                    <div style="margin-top: 10px; font-size: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #4CAF50;">Runtime is installed.</span>
                        <button id="lb-delete-rt" style="font-size: 10px; padding: 2px 5px; color: #ff5555;">Delete Runtime</button>
                    </div>
                `;
            }

            this.container.innerHTML = `
                <h2 style="margin-top: 0; display: flex; justify-content: space-between; align-items: center;">
                    Local Brain
                </h2>

                <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">1. Installation & Readiness</h3>
                    <div style="font-size: 12px; color: #ccc;">
                        <div><strong>Mode:</strong> <span style="color: cyan;">${activeModeLabel}</span></div>
                        <div><strong>System:</strong> ${profile.os} (${profile.arch}), ${profile.totalRamGB.toFixed(1)}GB RAM, ${profile.gpuDetected}</div>
                        <div><strong>Storage:</strong> ${status.modelStorageLocation}</div>
                    </div>
                    ${installRtHtml}
                </div>

                <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">2. Models</h3>
                    ${activeDownloadsHtml}
                    ${failedDownloadsHtml}
                    <div style="margin-bottom: 15px;">
                        <strong style="font-size: 12px; display: block; margin-bottom: 5px;">Available to Download:</strong>
                        ${manifestsHtml}
                    </div>
                    <div>
                        <strong style="font-size: 12px; display: block; margin-bottom: 5px;">Installed Models:</strong>
                        <div style="font-size: 12px;">${modelListHtml}</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px; padding-bottom: 10px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px;">3. Runtime Control</h3>
                    <div style="font-size: 12px; margin-bottom: 10px;">
                        <div><strong>State:</strong> <span style="color: ${rtStatus.state === 'running' ? '#4CAF50' : rtStatus.state === 'error' ? 'red' : 'cyan'};">${rtStatus.state.toUpperCase()}</span></div>
                        <div><strong>Active Model:</strong> ${rtStatus.activeModelId || 'None'}</div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button id="lb-start" ${canStart ? '' : 'disabled'} style="padding: 4px 10px;">Start</button>
                        <button id="lb-stop" ${canStop ? '' : 'disabled'} style="padding: 4px 10px;">Stop</button>
                        <button id="lb-restart" ${canRestart ? '' : 'disabled'} style="padding: 4px 10px;">Restart</button>
                    </div>
                    ${logsHtml}
                </div>
            `;

            // Attach event listeners safely
            const attach = (selector: string, cb: (el: Element) => void) => {
                const els = this.container.querySelectorAll(selector);
                els.forEach(el => el.addEventListener('click', () => cb(el)));
            };

            attach('#lb-start', async () => {
                try {
                    await this.localBrainService.startRuntime();
                    this.updateContent();
                } catch (err) {
                    alert(`Failed to start: ${String(err)}`);
                }
            });
            attach('#lb-stop', async () => {
                await this.localBrainService.stopRuntime();
                this.updateContent();
            });
            attach('#lb-restart', async () => {
                try {
                    await this.localBrainService.restartRuntime();
                    this.updateContent();
                } catch (err) {
                    alert(`Failed to restart: ${String(err)}`);
                }
            });
            attach('#lb-install-rt', async () => {
                try {
                    const res = await this.localBrainService.installRuntime('llama.cpp');
                    if (res.status === 'failed') alert(res.error);
                    this.updateContent();
                } catch (err) {
                    alert(`Failed to install runtime: ${String(err)}`);
                }
            });
            attach('#lb-delete-rt', async () => {
                if (confirm('Are you sure you want to delete the local runtime binary?')) {
                    await this.localBrainService.deleteRuntime('llama.cpp');
                    this.updateContent();
                }
            });

            // Dynamic list handlers
            attach('.lb-download', async (el) => {
                const modelId = el.getAttribute('data-modelid');
                if (modelId) {
                    await this.localBrainService.downloadModel(modelId, false);
                    this.updateContent();
                }
            });
            attach('.lb-download-license', async (el) => {
                const modelId = el.getAttribute('data-modelid');
                const license = el.getAttribute('data-license');
                const homepage = el.getAttribute('data-homepage');
                if (modelId) {
                    const accept = confirm(`This model requires you to accept its license agreement before downloading.\n\nLicense: ${license}\nMore info: ${homepage}\n\nDo you accept these terms?`);
                    if (accept) {
                        await this.localBrainService.downloadModel(modelId, true);
                        this.updateContent();
                    } else {
                        alert("Download cancelled. License must be accepted.");
                    }
                }
            });
            attach('.lb-cancel-dl', async (el) => {
                const taskId = el.getAttribute('data-taskid');
                if (taskId) {
                    await this.localBrainService.cancelDownload(taskId);
                    this.updateContent();
                }
            });
            attach('.lb-del-model', async (el) => {
                const modelId = el.getAttribute('data-modelid');
                if (modelId) {
                    if (confirm(`Are you sure you want to delete model ${modelId}?`)) {
                        await this.localBrainService.deleteInstalledModel(modelId);
                        this.updateContent();
                    }
                }
            });

        } catch (e) {
            this.container.innerHTML = `<div style="color: red;">Error loading Local Brain status: ${String(e)}</div>`;
        }
    }
}
