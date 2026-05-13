import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { CommandService } from '@theia/core/lib/common/command';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { ForgeConductorService, ProjectState, ProjectTask, HumanAction, RecommendedAction } from '../common/protocol';

export const ForgeConductorWidgetOptions = {
    id: 'localforge-conductor-widget',
    label: 'Forge Conductor'
};

@injectable()
export class ForgeConductorWidget extends BaseWidget {

    @inject(ForgeConductorService)
    protected readonly conductorService!: ForgeConductorService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(CommandService)
    protected readonly commandService!: CommandService;

    private container: HTMLDivElement;
    private refreshInterval: any;

    private currentState?: ProjectState;
    private tasks: ProjectTask[] = [];
    private humanActions: HumanAction[] = [];
    private recommendations: RecommendedAction[] = [];

    constructor() {
        super();
        this.id = ForgeConductorWidgetOptions.id;
        this.title.label = ForgeConductorWidgetOptions.label;
        this.title.caption = ForgeConductorWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-sitemap';
        this.addClass('localforge-conductor-widget');

        this.container = document.createElement('div');
        this.container.style.padding = '15px';
        this.container.style.overflowY = 'auto';
        this.container.style.height = '100%';

        this.node.appendChild(this.container);
    }

    @postConstruct()
    protected async init(): Promise<void> {
        await this.fetchData();
        this.render();

        this.conductorService.onStateUpdated(() => {
            this.fetchData().then(() => this.render());
        });

        this.refreshInterval = setInterval(() => {
            this.fetchData().then(() => this.render());
        }, 5000); // refresh occasionally to catch out-of-band updates
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.fetchData().then(() => this.render());
    }

    public override dispose(): void {
        clearInterval(this.refreshInterval);
        super.dispose();
    }

    private async fetchData() {
        if (!this.workspaceService.workspace) return;
        const uri = this.workspaceService.workspace.resource.toString();

        try {
            this.currentState = await this.conductorService.getProjectState(uri);
            this.tasks = await this.conductorService.getTasks(uri);
            this.humanActions = await this.conductorService.getHumanActions(uri);
            this.recommendations = await this.conductorService.getNextRecommendedActions(uri);
        } catch (e) {
            console.error("Failed to fetch conductor state", e);
        }
    }

    private render() {
        if (!this.currentState) {
            this.container.innerHTML = `<div style="color:#888; text-align:center; margin-top:20px;">No workspace active.</div>`;
            return;
        }

        const healthColor = this.currentState.health === 'healthy' ? '#4CAF50' : this.currentState.health === 'warning' ? '#FF9800' : '#ff5555';

        const lastTask = this.tasks.find(t => t.id === this.currentState?.lastCompletedTaskId);

        const pendingActionsHtml = this.humanActions.filter(a => a.status === 'pending').map(a => `
            <div style="background: rgba(255, 152, 0, 0.1); border: 1px solid #FF9800; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                <h4 style="margin: 0 0 5px 0; color: #FF9800;">Human Required</h4>
                <div style="font-size: 12px; color: #ccc;">
                    <strong>Action:</strong> ${a.description}<br/>
                    <strong>Reason:</strong> ${a.reason}
                </div>
                <button class="fc-resolve-btn" data-id="${a.id}" style="margin-top: 10px; padding: 4px 10px; background: #FF9800; color: white; border: none; cursor: pointer;">Mark Resolved</button>
            </div>
        `).join('');

        const recsHtml = this.recommendations.map(r => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid #444; padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                <h4 style="margin: 0 0 5px 0; color: ${r.isHumanAction ? '#FF9800' : 'cyan'};">${r.title}</h4>
                <div style="font-size: 12px; color: #ccc;">${r.description}</div>
                ${r.delegationId ? `<button class="fc-delegate-btn" data-did="${r.delegationId}" style="margin-top: 10px; padding: 4px 10px; background: #007acc; color: white; border: none; cursor: pointer;">Execute</button>` : ''}
            </div>
        `).join('');

        this.container.innerHTML = `
            <h2 style="margin-top: 0;">Forge Conductor</h2>
            <p style="color: #ccc; font-size: 12px;">Managing workspace state and recommending the next best move.</p>

            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <div style="flex: 1; padding: 10px; background: rgba(0,0,0,0.2); border-left: 4px solid #007acc; border-radius: 4px;">
                    <h3 style="margin: 0 0 5px 0; font-size: 10px; text-transform: uppercase; color: #888;">Current Phase</h3>
                    <div style="font-size: 14px; color: white; font-weight: bold;">${this.currentState.phase}</div>
                </div>
                <div style="flex: 1; padding: 10px; background: rgba(0,0,0,0.2); border-left: 4px solid ${healthColor}; border-radius: 4px;">
                    <h3 style="margin: 0 0 5px 0; font-size: 10px; text-transform: uppercase; color: #888;">Health</h3>
                    <div style="font-size: 14px; color: ${healthColor}; font-weight: bold; text-transform: capitalize;">${this.currentState.health}</div>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px;">Recent Progress</h3>
                <div style="font-size: 12px; color: #ccc;">
                    ${lastTask ? `Last completed task: <span style="color: white;">${lastTask.title}</span>` : 'No tracked tasks completed yet.'}
                </div>
            </div>

            ${pendingActionsHtml ? `<div style="margin-bottom: 20px;"><h3 style="margin: 0 0 10px 0; font-size: 14px;">Blockers</h3>${pendingActionsHtml}</div>` : ''}

            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px;">Next Recommended Actions</h3>
                ${recsHtml || '<div style="font-size: 12px; color: #888;">You are fully caught up!</div>'}
            </div>
        `;

        const attach = (selector: string, cb: (el: Element) => void) => {
            const els = this.container.querySelectorAll(selector);
            els.forEach(el => el.addEventListener('click', () => cb(el)));
        };

        attach('.fc-resolve-btn', async (btn) => {
            const id = btn.getAttribute('data-id');
            if (id && this.workspaceService.workspace) {
                await this.conductorService.resolveHumanAction(this.workspaceService.workspace.resource.toString(), id);
                this.fetchData().then(() => this.render());
            }
        });

        attach('.fc-delegate-btn', async (btn) => {
            const did = btn.getAttribute('data-did');
            if (did && this.workspaceService.workspace) {
                const res = await this.conductorService.delegateAction(this.workspaceService.workspace.resource.toString(), did);
                if (res.success) {

                    // Simple UI routing based on delegation IDs returned by conductor
                    if (did === 'delegate_open_doctor') await this.commandService.executeCommand('localforge.dependencyDoctor');
                    if (did === 'delegate_open_scout') await this.commandService.executeCommand('localforge.appBlueprint.new');
                    if (did === 'delegate_open_chat') await this.commandService.executeCommand('localBrainChat:toggle');

                } else {
                    alert(`Failed to delegate: ${res.message}`);
                }
            }
        });
    }
}
