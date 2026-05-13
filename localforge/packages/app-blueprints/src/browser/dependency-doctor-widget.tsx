import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { DependencyDoctorService, DetectedIssue } from '../common/protocol';
import { PrimaryActionButton, SectionHeader, ActionCard, EmptyState } from '@localforge/ui';

export const DependencyDoctorWidgetOptions = {
    id: 'localforge-dependency-doctor-widget',
    label: 'Dependency Doctor'
};

@injectable()
export class DependencyDoctorWidget extends ReactWidget {

    @inject(DependencyDoctorService)
    protected readonly doctorService!: DependencyDoctorService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    private issues: DetectedIssue[] = [];
    private applyingIds: Set<string> = new Set();

    constructor() {
        super();
        this.id = DependencyDoctorWidgetOptions.id;
        this.title.label = DependencyDoctorWidgetOptions.label;
        this.title.caption = DependencyDoctorWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-medkit';
        this.addClass('localforge-dependency-doctor-widget');
    }

    @postConstruct()
    protected async init(): Promise<void> {


        this.doctorService.onIssuesUpdated(issues => {
            this.issues = issues;
            this.update();
        });

        if (this.workspaceService.workspace) {
            this.issues = await this.doctorService.listActiveIssues(this.workspaceService.workspace.resource.toString());
            this.update();
        }
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.update();
    }

    protected render(): React.ReactNode {
        if (!this.workspaceService.workspace) {
            return <EmptyState iconClass="fa-folder-open" title="No Workspace" description="Open a folder to start using Dependency Doctor." />;
        }

        if (this.issues.length === 0) {
            return <EmptyState iconClass="fa-check-circle" title="All Systems Normal" description="Dependency Doctor is watching your Live Preview for errors." />;
        }

        return (
            <div style={{ padding: '15px', color: '#ccc', fontSize: '13px' }}>
                <SectionHeader
                    title="Dependency Doctor"
                    description="The doctor has found potential issues in your project."
                    rightContent={
                        <span style={{ fontSize: '12px', background: '#ff5555', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>
                            {this.issues.length} Issues
                        </span>
                    }
                />

                {this.issues.map(issue => {
                    const isCritical = issue.severity === 'critical';
                    const color = isCritical ? '#ff5555' : '#FF9800';
                    const canAutoFix = issue.action.isSafeAutoFix;
                    const isApplying = this.applyingIds.has(issue.id);

                    return (
                        <ActionCard key={issue.id} title={issue.issueSummary} iconClass="fa-exclamation-triangle" borderColor={color}>
                            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                                <strong>Why it happened:</strong><br/>
                                {issue.likelyCause}
                            </div>
                            <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                                <strong>Plain-English explanation:</strong><br/>
                                {issue.explanation}
                            </div>
                            <div style={{ fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '5px', fontFamily: 'monospace', border: '1px solid #444', marginBottom: '10px' }}>
                                {issue.rawLog}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                <div style={{ fontSize: '12px', color: 'cyan' }}>
                                    <strong>Suggested Fix:</strong> {issue.suggestedFix}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <PrimaryActionButton
                                        disabled={isApplying}
                                        style={{ background: canAutoFix ? '#4CAF50' : '#FF9800' }}
                                        onClick={async () => {
                                            this.applyingIds.add(issue.id);
                                            this.update();
                                            try {
                                                const res = await this.doctorService.applyFix(this.workspaceService.workspace!.resource.toString(), issue.id);
                                                if (!res.success) alert(`Failed to apply fix: ${res.error || res.message}`);
                                            } catch (e) {
                                                alert(`Error: ${String(e)}`);
                                            } finally {
                                                this.applyingIds.delete(issue.id);
                                                this.update();
                                            }
                                        }}
                                    >
                                        {isApplying ? 'Fixing...' : (canAutoFix ? 'Auto-Fix' : 'Acknowledge')}
                                    </PrimaryActionButton>

                                    <PrimaryActionButton
                                        variant="secondary"
                                        disabled={isApplying}
                                        onClick={async () => {
                                            await this.doctorService.dismissIssue(this.workspaceService.workspace!.resource.toString(), issue.id);
                                        }}
                                    >
                                        Dismiss
                                    </PrimaryActionButton>
                                </div>
                            </div>
                        </ActionCard>
                    );
                })}
            </div>
        );
    }
}
