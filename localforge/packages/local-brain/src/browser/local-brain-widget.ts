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
    private refreshButton: HTMLButtonElement;

    constructor() {
        super();
        this.id = LocalBrainWidgetOptions.id;
        this.title.label = LocalBrainWidgetOptions.label;
        this.title.caption = LocalBrainWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-brain'; // using font-awesome placeholder
        this.addClass('local-brain-widget');

        this.container = document.createElement('div');
        this.container.style.padding = '10px';

        this.refreshButton = document.createElement('button');
        this.refreshButton.innerText = 'Refresh Status';
        this.refreshButton.style.marginTop = '10px';
        this.refreshButton.onclick = () => this.updateContent();

        this.node.appendChild(this.container);
        this.node.appendChild(this.refreshButton);
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
            const activeMode = await this.localBrainService.getActiveMode();
            const modes = await this.localBrainService.listModes();
            const models = await this.localBrainService.listInstalledModels();

            this.container.innerHTML = `
                <h2>Local Brain</h2>
                <div style="margin-bottom: 15px;">
                    <strong>Status:</strong> ${status.message}
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Active Mode:</strong> <span style="color: cyan;">${activeMode}</span>
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Available Modes:</strong>
                    <ul>
                        ${modes.map(m => `<li>${m.label} - <small>${m.description}</small></li>`).join('')}
                    </ul>
                </div>
                <div style="margin-bottom: 15px;">
                    <strong>Installed Models:</strong>
                    <ul>
                        ${models.map(m => `<li>${m.name} ${m.isMock ? '(Mock)' : ''}</li>`).join('')}
                    </ul>
                </div>
            `;
        } catch (e) {
            this.container.innerHTML = `<div style="color: red;">Error loading Local Brain status: ${String(e)}</div>`;
        }
    }
}
