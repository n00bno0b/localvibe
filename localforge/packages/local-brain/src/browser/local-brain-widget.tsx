import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { LocalBrainService } from '../common/protocol';
import {
    RuntimeStatus, MachineProfile,
    LocalBrainModelManifest, InstalledModel, RuntimeLogEntry, DownloadTaskStatus, RuntimeInstallStatus
} from '../common/protocol';

import { StatusBadge, PrimaryActionButton, SectionHeader, ActionCard, EmptyState } from '@localforge/ui';

export const LocalBrainWidgetOptions = {
    id: 'local-brain-widget',
    label: 'Local Brain'
};

@injectable()
export class LocalBrainWidget extends ReactWidget {

    @inject(LocalBrainService)
    protected readonly localBrainService!: LocalBrainService;

    private refreshInterval: any;

    private rtStatus?: RuntimeStatus;

    private profile?: MachineProfile;
    private manifests: LocalBrainModelManifest[] = [];
    private installedModels: InstalledModel[] = [];
    private logs: RuntimeLogEntry[] = [];
    private downloads: DownloadTaskStatus[] = [];
    private rtInstallStatus?: RuntimeInstallStatus;

    private runtimes: any[] = [];
    private recRuntime: any = undefined;

    constructor() {
        super();
        this.id = LocalBrainWidgetOptions.id;
        this.title.label = LocalBrainWidgetOptions.label;
        this.title.caption = LocalBrainWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-brain';
        this.addClass('local-brain-widget');
    }

    @postConstruct()
    protected async init(): Promise<void> {

        await this.fetchData();
        this.refreshInterval = setInterval(() => this.fetchData(), 2000);
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.fetchData();
    }

    public override dispose(): void {
        clearInterval(this.refreshInterval);
        super.dispose();
    }

    private async fetchData() {
        try {
            this.rtStatus = await this.localBrainService.getRuntimeStatus();

            this.profile = await this.localBrainService.getMachineProfile();
            this.manifests = await this.localBrainService.getAvailableManifests();
            this.installedModels = await this.localBrainService.listInstalledModels();
            this.logs = await this.localBrainService.getRuntimeLogs();
            this.downloads = await this.localBrainService.listDownloadTasks();
            this.rtInstallStatus = await this.localBrainService.getRuntimeInstallStatus();
            this.runtimes = await this.localBrainService.listAvailableRuntimes();
            this.recRuntime = await this.localBrainService.getRecommendedRuntime();



            this.update(); // Trigger React re-render
        } catch (e) {
            console.error('Failed to fetch Local Brain status', e);
        }
    }

    protected render(): React.ReactNode {
        if (!this.profile || !this.rtStatus) {
            return <EmptyState iconClass="fa-spinner fa-spin" title="Loading..." description="Fetching system profile..." />;
        }

        const rtTask = this.downloads.find(d => this.runtimes.some(r => r.id === d.modelId));

        return (
            <div style={{ padding: '15px', color: '#ccc', fontSize: '13px' }}>

                <SectionHeader title="1. Installation & Readiness" rightContent={<StatusBadge status={this.rtInstallStatus?.installed ? 'success' : 'warning'} label={this.rtInstallStatus?.installed ? 'Installed' : 'Missing'} />} />

                <div style={{ marginBottom: '20px' }}>
                    <div style={{ marginBottom: '10px' }}><strong>System:</strong> {this.profile.os} ({this.profile.arch}), {this.profile.totalRamGB.toFixed(1)}GB RAM, {this.profile.gpuDetected}</div>

                    {!this.rtInstallStatus?.installed ? (
                        rtTask && ['downloading', 'pending', 'verifying'].includes(rtTask.status) ? (
                            <ActionCard title="Installing Runtime..." iconClass="fa-download" borderColor="#007acc">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Status: {rtTask.status}</span>
                                    <PrimaryActionButton variant="secondary" onClick={() => this.localBrainService.cancelRuntimeInstall(rtTask.taskId).then(()=>this.fetchData())}>Cancel</PrimaryActionButton>
                                </div>
                                <div style={{ width: '100%', background: '#333', height: '6px', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                                    <div style={{ width: `${rtTask.progress}%`, background: '#4CAF50', height: '100%' }}></div>
                                </div>
                            </ActionCard>
                        ) : (
                            <ActionCard title="Action Required: Missing Runtime" iconClass="fa-exclamation-triangle" borderColor="#FF9800">
                                <p style={{ margin: '0 0 10px 0', fontSize: '12px' }}>Recommended: <strong>{this.recRuntime?.displayName}</strong></p>
                                <PrimaryActionButton onClick={async () => {
                                    const rtIdToInstall = this.recRuntime ? this.recRuntime.id : 'llama-cpp-test-fixture';
                                    const res = await this.localBrainService.installRuntime(rtIdToInstall);
                                    if (res.status === 'failed') alert(res.error);
                                    this.fetchData();
                                }}>Install Recommended Runtime</PrimaryActionButton>
                            </ActionCard>
                        )
                    ) : (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <PrimaryActionButton variant="secondary" onClick={() => alert('Runtime is located in ~/.localforge/runtimes/')}>Open Folder</PrimaryActionButton>
                            <PrimaryActionButton variant="danger" onClick={async () => {
                                if (confirm('Are you sure you want to delete the local runtime binary?')) {
                                    await this.localBrainService.deleteRuntime('llama.cpp');
                                    this.fetchData();
                                }
                            }}>Delete Runtime</PrimaryActionButton>
                        </div>
                    )}
                </div>

                <SectionHeader title="2. Models" rightContent={<StatusBadge status={this.installedModels.length > 0 ? 'success' : 'neutral'} label={`${this.installedModels.length} Installed`} />} />
                <div style={{ marginBottom: '20px' }}>
                    {this.downloads.filter(d => ['downloading', 'pending', 'verifying'].includes(d.status) && !this.runtimes.some(r => r.id === d.modelId)).map(d => (
                        <ActionCard key={d.taskId} title={`Downloading ${d.modelId}`} iconClass="fa-download" borderColor="#007acc">
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Status: {d.status} {d.speedBytesPerSec ? `(${(d.speedBytesPerSec / (1024*1024)).toFixed(1)} MB/s)` : ''}</span>
                                <PrimaryActionButton variant="secondary" onClick={() => this.localBrainService.cancelDownload(d.taskId).then(()=>this.fetchData())}>Cancel</PrimaryActionButton>
                            </div>
                            <div style={{ width: '100%', background: '#333', height: '6px', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                                <div style={{ width: `${d.progress}%`, background: '#4CAF50', height: '100%' }}></div>
                            </div>
                        </ActionCard>
                    ))}

                    <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'white' }}>Available to Download</h4>
                    {this.manifests.map(m => {
                        const isInstalled = this.installedModels.some(im => im.manifestId === m.id || im.name === m.fileName);
                        const isDownloading = this.downloads.some(d => d.modelId === m.id && ['downloading', 'pending', 'verifying'].includes(d.status));

                        let rightAction = <span style={{ color: '#888' }}>No URL</span>;
                        if (isInstalled) rightAction = <span style={{ color: '#4CAF50' }}>Installed</span>;
                        else if (isDownloading) rightAction = <span style={{ color: 'cyan' }}>Downloading...</span>;
                        else if (m.downloadUrl) {
                            rightAction = <PrimaryActionButton onClick={async () => {
                                if (m.requiresLicenseAcceptance) {
                                    const licenseText = (m.license || 'Proprietary');
                                    if (confirm(`License required:\n\n${licenseText}\n\nDo you accept?`)) {
                                        await this.localBrainService.downloadModel(m.id, true);
                                    } else return;
                                } else {
                                    await this.localBrainService.downloadModel(m.id, false);
                                }
                                this.fetchData();
                            }}>Download</PrimaryActionButton>;
                        }

                        return (
                            <ActionCard key={m.id} title={m.displayName} description={`Tier: ${m.mode} | Size: ~${m.estimatedSizeGB}GB | RAM Req: ${m.minRamGB}GB+`}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-20px' }}>
                                    {rightAction}
                                </div>
                            </ActionCard>
                        );
                    })}

                    <h4 style={{ margin: '15px 0 10px 0', fontSize: '13px', color: 'white' }}>Installed Models</h4>
                    {this.installedModels.length === 0 ? <p style={{ color: '#888' }}>No models installed.</p> : (
                        <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            {this.installedModels.map(m => (
                                <li key={m.id} style={{ marginBottom: '5px' }}>
                                    {m.name} <button style={{ border: 'none', background: 'transparent', color: '#ff5555', cursor: 'pointer', marginLeft: '10px' }} onClick={async () => {
                                        if (confirm(`Delete ${m.id}?`)) {
                                            await this.localBrainService.deleteInstalledModel(m.id);
                                            this.fetchData();
                                        }
                                    }}>Delete</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <SectionHeader title="3. Runtime Control" rightContent={<StatusBadge status={this.rtStatus.state === 'running' ? 'success' : this.rtStatus.state === 'error' ? 'error' : 'warning'} label={this.rtStatus.state.toUpperCase()} />} />

                <div style={{ marginBottom: '10px' }}>
                    <strong>Active Model:</strong> {this.rtStatus.activeModelId || 'None'}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <PrimaryActionButton
                        disabled={!this.rtStatus.installed || this.installedModels.length === 0 || !['stopped', 'not_ready'].includes(this.rtStatus.state)}
                        onClick={() => this.localBrainService.startRuntime().then(()=>this.fetchData())}
                    >Start</PrimaryActionButton>
                    <PrimaryActionButton
                        variant="secondary"
                        disabled={!['running', 'starting'].includes(this.rtStatus.state)}
                        onClick={() => this.localBrainService.stopRuntime().then(()=>this.fetchData())}
                    >Stop</PrimaryActionButton>
                    <PrimaryActionButton
                        variant="secondary"
                        disabled={!['running', 'starting'].includes(this.rtStatus.state)}
                        onClick={() => this.localBrainService.restartRuntime().then(()=>this.fetchData())}
                    >Restart</PrimaryActionButton>
                </div>

                {this.logs.length > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', fontFamily: 'monospace', fontSize: '11px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #444', borderRadius: '4px' }}>
                        {this.logs.slice().reverse().map((l, i) => (
                            <div key={i} style={{ color: l.level === 'error' ? '#ff5555' : l.level === 'warn' ? '#FF9800' : '#ccc', whiteSpace: 'pre-wrap', marginBottom: '2px' }}>
                                [{l.level}] {l.message}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
}
