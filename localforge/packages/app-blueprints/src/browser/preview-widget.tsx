import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { PreviewService, PreviewStatus, DependencyDoctorService, DetectedIssue } from '../common/protocol';
import { CommandService } from '@theia/core/lib/common/command';

export const PreviewWidgetOptions = {
    id: 'localforge-preview-widget',
    label: 'Live Preview'
};

@injectable()
export class PreviewWidget extends ReactWidget {

    @inject(PreviewService)
    protected readonly previewService!: PreviewService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(DependencyDoctorService)
    protected readonly doctorService!: DependencyDoctorService;

    @inject(CommandService)
    protected readonly commandService!: CommandService;

    private status?: PreviewStatus;
    private doctorIssues: DetectedIssue[] = [];
    private iframeKey = 0; // used to force refresh iframe

    constructor() {
        super();
        this.id = PreviewWidgetOptions.id;
        this.title.label = PreviewWidgetOptions.label;
        this.title.caption = PreviewWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-globe';
        this.addClass('localforge-preview-widget');
    }

    @postConstruct()
    protected async init(): Promise<void> {


        this.previewService.onStateChange(status => {
            this.status = status;
            this.checkDoctor();
        });

        this.previewService.onLog(log => {
            if (log.type === 'stderr') console.error(`[Preview] ${log.message}`);
            else console.log(`[Preview] ${log.message}`);
        });

        const initial = await this.previewService.getStatus();
        this.status = initial;
        this.checkDoctor();
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.update();
    }

    private async checkDoctor() {
        if (this.status && (this.status.state === 'crashed' || this.status.state === 'port_unavailable') && this.workspaceService.workspace) {
            this.doctorIssues = await this.doctorService.listActiveIssues(this.workspaceService.workspace.resource.toString());
        } else {
            this.doctorIssues = [];
        }
        this.update();
    }

    private formatStateLabel(state: string): string {
        return state.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    protected render(): React.ReactNode {
        if (!this.status) return null;

        const { state, url, message } = this.status;
        const isRunningOrStarting = ['installing_dependencies', 'starting_server', 'waiting_for_localhost', 'running'].includes(state);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', padding: '5px', background: '#252526', borderBottom: '1px solid #3e3e42', gap: '5px', alignItems: 'center' }}>
                    <button disabled={isRunningOrStarting} onClick={() => {
                        const uri = this.workspaceService.workspace?.resource.toString();
                        if (uri) this.previewService.startPreview(uri);
                    }}>Start</button>
                    <button disabled={!isRunningOrStarting} onClick={() => {
                        const uri = this.workspaceService.workspace?.resource.toString();
                        if (uri) this.previewService.restartPreview(uri);
                    }}>Restart</button>
                    <button disabled={!isRunningOrStarting} onClick={() => this.previewService.stopPreview()}>Stop</button>

                    <input
                        type="text"
                        readOnly
                        value={url || ''}
                        placeholder="http://localhost:..."
                        style={{ flex: 1, background: '#3c3c3c', color: '#ccc', border: '1px solid #555', padding: '2px 5px' }}
                    />

                    <button onClick={() => { this.iframeKey++; this.update(); }}>Refresh</button>
                    <button disabled={state !== 'running'} onClick={() => { if (url) window.open(url, '_blank'); }}>Open External</button>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, position: 'relative', background: state === 'running' ? '#fff' : '#1e1e1e' }}>
                    {state === 'running' && url ? (
                        <iframe
                            key={this.iframeKey}
                            src={url}
                            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                        />
                    ) : (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', color: '#ccc' }}>
                            <i className={`fa ${state === 'stopped' ? 'fa-stop-circle' : (state === 'crashed' || state === 'port_unavailable' || state === 'missing_directory') ? 'fa-exclamation-triangle' : 'fa-cog fa-spin'}`} style={{ fontSize: '32px', marginBottom: '15px', color: (state === 'crashed' || state === 'port_unavailable' || state === 'missing_directory') ? '#ff5555' : '#ccc' }} />
                            <h3 style={{ margin: '0 0 10px 0', color: (state === 'crashed' || state === 'port_unavailable' || state === 'missing_directory') ? '#ff5555' : '#ccc' }}>{this.formatStateLabel(state)}</h3>
                            <p style={{ fontSize: '12px' }}>{message || ''}</p>

                            {this.doctorIssues.length > 0 && (
                                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 85, 85, 0.1)', border: '1px solid #ff5555', borderRadius: '4px' }}>
                                    <strong style={{ color: '#ff5555' }}>Dependency Doctor found an issue:</strong><br/>
                                    {this.doctorIssues[0].issueSummary}
                                    <br/>
                                    <button
                                        style={{ marginTop: '10px', padding: '4px 10px', background: '#ff5555', color: 'white', border: 'none', cursor: 'pointer' }}
                                        onClick={() => this.commandService.executeCommand('localforge.dependencyDoctor')}
                                    >Open Doctor</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
