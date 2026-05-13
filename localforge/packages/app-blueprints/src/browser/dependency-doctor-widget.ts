import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { DependencyDoctorService, DetectedIssue } from '../common/protocol';

export const DependencyDoctorWidgetOptions = {
    id: 'localforge-dependency-doctor-widget',
    label: 'Dependency Doctor'
};

@injectable()
export class DependencyDoctorWidget extends BaseWidget {

    @inject(DependencyDoctorService)
    protected readonly doctorService!: DependencyDoctorService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    private container: HTMLDivElement;
    private issues: DetectedIssue[] = [];

    constructor() {
        super();
        this.id = DependencyDoctorWidgetOptions.id;
        this.title.label = DependencyDoctorWidgetOptions.label;
        this.title.caption = DependencyDoctorWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-medkit'; // Font-Awesome placeholder
        this.addClass('localforge-dependency-doctor-widget');

        this.container = document.createElement('div');
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.width = '100%';
        this.container.style.padding = '15px';
        this.container.style.overflowY = 'auto';

        this.node.appendChild(this.container);
    }

    @postConstruct()
    protected async init(): Promise<void> {
        this.doctorService.onIssuesUpdated(issues => {
            this.issues = issues;
            this.updateContent();
        });

        // Fetch initial
        if (this.workspaceService.workspace) {
            this.issues = await this.doctorService.listActiveIssues(this.workspaceService.workspace.resource.toString());
        }
        this.updateContent();
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.updateContent();
    }

    public updateContent(): void {
        if (this.issues.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; color: #888; margin-top: 40px;">
                    <i class="fa fa-check-circle" style="font-size: 32px; color: #4CAF50; margin-bottom: 15px;"></i>
                    <h3>All Systems Normal</h3>
                    <p style="font-size: 12px;">Dependency Doctor is watching your Live Preview for errors.</p>
                </div>
            `;
            return;
        }

        const issuesHtml = this.issues.map(issue => {
            const isCritical = issue.severity === 'critical';
            const color = isCritical ? '#ff5555' : '#FF9800';
            const canAutoFix = issue.action.isSafeAutoFix;

            return `
            <div style="background: rgba(0,0,0,0.2); border-left: 4px solid ${color}; padding: 10px; margin-bottom: 15px; border-radius: 4px;">
                <h4 style="margin: 0 0 5px 0; color: ${color};">
                    <i class="fa fa-exclamation-triangle" style="margin-right: 5px;"></i> ${issue.issueSummary}
                </h4>

                <div style="font-size: 12px; color: #ccc; margin-bottom: 10px;">
                    <strong>Why it happened:</strong><br/>
                    ${issue.likelyCause}
                </div>

                <div style="font-size: 12px; color: #ccc; margin-bottom: 10px;">
                    <strong>Plain-English explanation:</strong><br/>
                    ${issue.explanation}
                </div>

                <div style="font-size: 12px; background: rgba(0,0,0,0.3); padding: 5px; font-family: monospace; border: 1px solid #444; margin-bottom: 10px;">
                    ${issue.rawLog}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <div style="font-size: 12px; color: cyan;">
                        <strong>Suggested Fix:</strong> ${issue.suggestedFix}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="dd-apply-btn" data-id="${issue.id}" style="padding: 4px 10px; background: ${canAutoFix ? '#4CAF50' : '#FF9800'}; color: white; border: none; cursor: pointer;">
                            ${canAutoFix ? 'Auto-Fix' : 'Acknowledge'}
                        </button>
                        <button class="dd-dismiss-btn" data-id="${issue.id}" style="padding: 4px 10px; background: #555; color: white; border: none; cursor: pointer;">Dismiss</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        this.container.innerHTML = `
            <h2 style="margin-top: 0; display: flex; align-items: center; justify-content: space-between;">
                Dependency Doctor
                <span style="font-size: 12px; background: #ff5555; color: white; padding: 2px 8px; border-radius: 12px;">${this.issues.length} Issues</span>
            </h2>
            <p style="color: #ccc; font-size: 12px;">The doctor has found potential issues in your project.</p>
            ${issuesHtml}
        `;

        const attach = (selector: string, cb: (el: Element) => void) => {
            const els = this.container.querySelectorAll(selector);
            els.forEach(el => el.addEventListener('click', () => cb(el)));
        };

        attach('.dd-apply-btn', async (el) => {
            const id = el.getAttribute('data-id');
            const btn = el as HTMLButtonElement;
            if (id && this.workspaceService.workspace) {
                btn.disabled = true;
                btn.innerText = 'Fixing...';
                try {
                    const result = await this.doctorService.applyFix(this.workspaceService.workspace.resource.toString(), id);
                    if (!result.success) {
                        alert(`Failed to apply fix: ${result.error || result.message}`);
                    }
                } catch (e) {
                    alert(`Error: ${String(e)}`);
                } finally {
                    btn.disabled = false;
                    btn.innerText = 'Auto-Fix';
                }
            }
        });

        attach('.dd-dismiss-btn', async (el) => {
            const id = el.getAttribute('data-id');
            if (id && this.workspaceService.workspace) {
                await this.doctorService.dismissIssue(this.workspaceService.workspace.resource.toString(), id);
            }
        });
    }
}
