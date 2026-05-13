import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { CommandService } from '@theia/core/lib/common/command';
import { ForgeConductorService, ProjectState, ProjectTask, HumanAction, RecommendedAction } from '../common/protocol';
import { PrimaryActionButton, SectionHeader, ActionCard, EmptyState } from '@localforge/ui';

export const ForgeConductorWidgetOptions = {
    id: 'localforge-conductor-widget',
    label: 'Forge Conductor'
};

@injectable()
export class ForgeConductorWidget extends ReactWidget {

    @inject(ForgeConductorService)
    protected readonly conductorService!: ForgeConductorService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(CommandService)
    protected readonly commandService!: CommandService;

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
    }

    @postConstruct()
    protected async init(): Promise<void> {

        await this.fetchData();

        this.conductorService.onStateUpdated(() => {
            this.fetchData();
        });

        this.refreshInterval = setInterval(() => this.fetchData(), 5000);
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
        if (!this.workspaceService.workspace) return;
        const uri = this.workspaceService.workspace.resource.toString();

        try {
            this.currentState = await this.conductorService.getProjectState(uri);
            this.tasks = await this.conductorService.getTasks(uri);
            this.humanActions = await this.conductorService.getHumanActions(uri);
            this.recommendations = await this.conductorService.getNextRecommendedActions(uri);
            this.update();
        } catch (e) {
            console.error("Failed to fetch conductor state", e);
        }
    }

    protected render(): React.ReactNode {
        if (!this.workspaceService.workspace) {
            return <EmptyState iconClass="fa-folder-open" title="No Workspace" description="Open a folder to start using Forge Conductor." />;
        }

        if (!this.currentState) {
            return <EmptyState iconClass="fa-spinner fa-spin" title="Loading..." description="Fetching project state..." />;
        }

        const lastTask = this.tasks.find(t => t.id === this.currentState?.lastCompletedTaskId);
        const pendingHumans = this.humanActions.filter(a => a.status === 'pending');

        return (
            <div style={{ padding: '15px', color: '#ccc', fontSize: '13px' }}>
                <SectionHeader title="Forge Conductor" description="Managing workspace state and recommending the next best move." />

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.2)', borderLeft: '4px solid #007acc', borderRadius: '4px' }}>
                        <h3 style={{ margin: '0 0 5px 0', fontSize: '10px', textTransform: 'uppercase', color: '#888' }}>Current Phase</h3>
                        <div style={{ fontSize: '14px', color: 'white', fontWeight: 'bold' }}>{this.currentState.phase}</div>
                    </div>
                    <div style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.2)', borderLeft: `4px solid ${this.currentState.health === 'healthy' ? '#4CAF50' : this.currentState.health === 'warning' ? '#FF9800' : '#ff5555'}`, borderRadius: '4px' }}>
                        <h3 style={{ margin: '0 0 5px 0', fontSize: '10px', textTransform: 'uppercase', color: '#888' }}>Health</h3>
                        <div style={{ fontSize: '14px', color: this.currentState.health === 'healthy' ? '#4CAF50' : this.currentState.health === 'warning' ? '#FF9800' : '#ff5555', fontWeight: 'bold', textTransform: 'capitalize' }}>
                            {this.currentState.health}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'white' }}>Recent Progress</h3>
                    <div style={{ fontSize: '12px' }}>
                        {lastTask ? <span>Last completed task: <strong style={{ color: 'white' }}>{lastTask.title}</strong></span> : 'No tracked tasks completed yet.'}
                    </div>
                </div>

                {pendingHumans.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'white' }}>Blockers</h3>
                        {pendingHumans.map(a => (
                            <ActionCard key={a.id} title="Human Required" borderColor="#FF9800">
                                <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                                    <strong>Action:</strong> {a.description}<br/>
                                    <strong>Reason:</strong> {a.reason}
                                </div>
                                <PrimaryActionButton variant="primary" style={{ background: '#FF9800' }} onClick={async () => {
                                    await this.conductorService.resolveHumanAction(this.workspaceService.workspace!.resource.toString(), a.id);
                                    this.fetchData();
                                }}>Mark Resolved</PrimaryActionButton>
                            </ActionCard>
                        ))}
                    </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'white' }}>Next Recommended Actions</h3>
                    {this.recommendations.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#888' }}>You are fully caught up!</div>
                    ) : (
                        this.recommendations.map(r => (
                            <ActionCard key={r.id} title={r.title} description={r.description} borderColor={r.isHumanAction ? '#FF9800' : '#444'}>
                                {r.delegationId && (
                                    <PrimaryActionButton onClick={async () => {
                                        const res = await this.conductorService.delegateAction(this.workspaceService.workspace!.resource.toString(), r.delegationId!);
                                        if (res.success) {
                                            if (r.delegationId === 'delegate_open_doctor') await this.commandService.executeCommand('localforge.dependencyDoctor');
                                            if (r.delegationId === 'delegate_open_scout') await this.commandService.executeCommand('localforge.appBlueprint.new');
                                            if (r.delegationId === 'delegate_open_chat') await this.commandService.executeCommand('localBrainChat:toggle');
                                        } else {
                                            alert(`Failed to delegate: ${res.message}`);
                                        }
                                    }}>Execute</PrimaryActionButton>
                                )}
                            </ActionCard>
                        ))
                    )}
                </div>
            </div>
        );
    }
}
