import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { PreviewService, PreviewStatus } from '../common/protocol';

export const PreviewWidgetOptions = {
    id: 'localforge-preview-widget',
    label: 'Live Preview'
};

@injectable()
export class PreviewWidget extends BaseWidget {

    @inject(PreviewService)
    protected readonly previewService!: PreviewService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    private container: HTMLDivElement;
    private toolbar: HTMLDivElement;
    private iframe: HTMLIFrameElement;
    private overlay: HTMLDivElement;

    private urlInput: HTMLInputElement;
    private startBtn: HTMLButtonElement;
    private restartBtn: HTMLButtonElement;
    private stopBtn: HTMLButtonElement;
    private openExtBtn: HTMLButtonElement;

    private currentUrl?: string;

    constructor() {
        super();
        this.id = PreviewWidgetOptions.id;
        this.title.label = PreviewWidgetOptions.label;
        this.title.caption = PreviewWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-globe';
        this.addClass('localforge-preview-widget');

        this.container = document.createElement('div');
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.width = '100%';

        // Toolbar
        this.toolbar = document.createElement('div');
        this.toolbar.style.display = 'flex';
        this.toolbar.style.padding = '5px';
        this.toolbar.style.background = '#252526';
        this.toolbar.style.borderBottom = '1px solid #3e3e42';
        this.toolbar.style.gap = '5px';
        this.toolbar.style.alignItems = 'center';

        this.startBtn = this.createButton('Start', () => this.handleStart());
        this.restartBtn = this.createButton('Restart', () => this.handleRestart());
        this.stopBtn = this.createButton('Stop', () => this.handleStop());

        this.urlInput = document.createElement('input');
        this.urlInput.type = 'text';
        this.urlInput.readOnly = true;
        this.urlInput.placeholder = 'http://localhost:...';
        this.urlInput.style.flex = '1';
        this.urlInput.style.background = '#3c3c3c';
        this.urlInput.style.color = '#ccc';
        this.urlInput.style.border = '1px solid #555';
        this.urlInput.style.padding = '2px 5px';

        const refreshBtn = this.createButton('Refresh', () => this.handleRefresh());
        this.openExtBtn = this.createButton('Open External', () => {
            if (this.currentUrl) window.open(this.currentUrl, '_blank');
        });

        this.toolbar.appendChild(this.startBtn);
        this.toolbar.appendChild(this.restartBtn);
        this.toolbar.appendChild(this.stopBtn);
        this.toolbar.appendChild(this.urlInput);
        this.toolbar.appendChild(refreshBtn);
        this.toolbar.appendChild(this.openExtBtn);

        // Content Area
        const contentArea = document.createElement('div');
        contentArea.style.flex = '1';
        contentArea.style.position = 'relative';

        this.iframe = document.createElement('iframe');
        this.iframe.style.width = '100%';
        this.iframe.style.height = '100%';
        this.iframe.style.border = 'none';
        this.iframe.style.background = '#fff';

        this.overlay = document.createElement('div');
        this.overlay.style.position = 'absolute';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.right = '0';
        this.overlay.style.bottom = '0';
        this.overlay.style.background = '#1e1e1e';
        this.overlay.style.color = '#ccc';
        this.overlay.style.display = 'flex';
        this.overlay.style.flexDirection = 'column';
        this.overlay.style.alignItems = 'center';
        this.overlay.style.justifyContent = 'center';
        this.overlay.style.padding = '20px';
        this.overlay.style.textAlign = 'center';

        contentArea.appendChild(this.iframe);
        contentArea.appendChild(this.overlay);

        this.container.appendChild(this.toolbar);
        this.container.appendChild(contentArea);
        this.node.appendChild(this.container);
    }

    private createButton(text: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.padding = '2px 8px';
        btn.style.cursor = 'pointer';
        btn.onclick = onClick;
        return btn;
    }

    @postConstruct()
    protected async init(): Promise<void> {
        this.previewService.onStateChange(status => this.handleStateChange(status));

        // Fetch initial state
        const initial = await this.previewService.getStatus();
        this.handleStateChange(initial);

        // In a real app we'd expose logs to a panel.
        // For now, we'll just log them to console so the Dependency Doctor can hook into them later.
        this.previewService.onLog(log => {
            if (log.type === 'stderr') {
                console.error(`[Preview] ${log.message}`);
            } else {
                console.log(`[Preview] ${log.message}`);
            }
        });
    }

    private handleStateChange(status: PreviewStatus) {
        this.currentUrl = status.url;
        this.urlInput.value = status.url || '';

        // Update button states
        const isRunningOrStarting = ['installing_dependencies', 'starting_server', 'waiting_for_localhost', 'running'].includes(status.state);
        this.startBtn.disabled = isRunningOrStarting;
        this.stopBtn.disabled = !isRunningOrStarting;
        this.restartBtn.disabled = !isRunningOrStarting;
        this.openExtBtn.disabled = status.state !== 'running';

        if (status.state === 'running' && status.url) {
            this.overlay.style.display = 'none';
            // Only update iframe src if it changed or it's empty to prevent reloads on pure state syncs
            if (this.iframe.src !== status.url) {
                this.iframe.src = status.url;
            }
        } else {
            this.overlay.style.display = 'flex';
            let icon = 'fa-cog fa-spin';
            let color = '#ccc';

            if (status.state === 'stopped') {
                icon = 'fa-stop-circle';
                // We shouldn't spin if stopped
                icon = 'fa-stop-circle';
            } else if (status.state === 'crashed' || status.state === 'port_unavailable' || status.state === 'missing_directory') {
                icon = 'fa-exclamation-triangle';
                color = '#ff5555';
            }

            this.overlay.innerHTML = `
                <i class="fa ${icon}" style="font-size: 32px; margin-bottom: 15px; color: ${color};"></i>
                <h3 style="margin: 0 0 10px 0; color: ${color};">${this.formatStateLabel(status.state)}</h3>
                <p style="font-size: 12px;">${status.message || ''}</p>
            `;
        }
    }

    private formatStateLabel(state: string): string {
        return state.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    private getWorkspaceUri(): string | undefined {
        return this.workspaceService.workspace?.resource.toString();
    }

    private async handleStart() {
        const uri = this.getWorkspaceUri();
        if (!uri) return alert('No workspace open');
        await this.previewService.startPreview(uri);
    }

    private async handleStop() {
        await this.previewService.stopPreview();
    }

    private async handleRestart() {
        const uri = this.getWorkspaceUri();
        if (!uri) return alert('No workspace open');
        await this.previewService.restartPreview(uri);
    }

    private handleRefresh() {
        if (this.currentUrl && this.iframe.src) {
            // Force iframe reload
            this.iframe.src = this.currentUrl;
        }
    }
}
