import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { PreviewService } from '../common/protocol';
import { AICodegenService, GeneratedPatch } from '../../../local-brain/src/common/protocol';

export const CodegenDiffWidgetOptions = {
    id: 'localforge-codegen-diff-widget',
    label: 'Code Diff Approval'
};

@injectable()
export class CodegenDiffWidget extends BaseWidget {

    @inject(AICodegenService)
    protected readonly codegenService!: AICodegenService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(PreviewService)
    protected readonly previewService!: PreviewService;

    private container: HTMLDivElement;
    private currentPatch: GeneratedPatch | null = null;

    constructor() {
        super();
        this.id = CodegenDiffWidgetOptions.id;
        this.title.label = CodegenDiffWidgetOptions.label;
        this.title.caption = CodegenDiffWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-code-fork';
        this.addClass('localforge-codegen-diff-widget');

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
        this.currentPatch = await this.codegenService.getActivePatch();
        this.render();
    }

    protected override async onUpdateRequest(msg: Message): Promise<void> {
        super.onUpdateRequest(msg);
        const patch = await this.codegenService.getActivePatch();
        if (patch) {
            this.currentPatch = patch;
        }
        this.render();
    }

    public presentPatch(patch: GeneratedPatch) {
        this.currentPatch = patch;
        this.render();
    }

    private render() {
        if (!this.currentPatch) {
            this.container.innerHTML = `
                <div style="text-align: center; color: #888; margin-top: 40px;">
                    <i class="fa fa-code" style="font-size: 32px; color: #555; margin-bottom: 15px;"></i>
                    <h3>No Active Code Changes</h3>
                    <p style="font-size: 12px;">Ask Local Brain to generate a feature to review diffs here.</p>
                </div>
            `;
            return;
        }

        const patch = this.currentPatch;

        const filesHtml = patch.files.map(f => {
            const isMod = f.action === 'modify';
            const isAdd = f.action === 'create';
            const color = isMod ? '#007acc' : isAdd ? '#4CAF50' : '#ff5555';

            // Very naive diff presentation for the vertical slice
            return `
            <div style="margin-bottom: 15px; border: 1px solid #444; border-radius: 4px; overflow: hidden;">
                <div style="background: rgba(255,255,255,0.05); padding: 5px 10px; border-bottom: 1px solid #444; display: flex; justify-content: space-between;">
                    <strong style="color: ${color}; font-size: 12px;">${f.action.toUpperCase()} ${f.path}</strong>
                </div>
                ${f.before ? `<div style="background: #2b0000; padding: 10px; font-size: 11px; font-family: monospace; white-space: pre-wrap; color: #ff8888;">- ${f.before.substring(0,100)}...</div>` : ''}
                ${f.after ? `<div style="background: #002b00; padding: 10px; font-size: 11px; font-family: monospace; white-space: pre-wrap; color: #88ff88;">+ ${f.after.substring(0,250)}...</div>` : ''}
            </div>
            `;
        }).join('');

        const commandsHtml = (patch.commands && patch.commands.length > 0) ? `
            <h4 style="margin: 15px 0 5px 0; font-size: 12px; color: #FF9800;">Required Commands:</h4>
            <ul style="font-size: 12px; color: #ccc; margin: 0 0 15px 0; padding-left: 20px;">
                ${patch.commands.map(c => `<li><code>${c.command}</code> <br><small style="color:#888;">Reason: ${c.reason}</small></li>`).join('')}
            </ul>
        ` : '';

        const risksHtml = (patch.risks && patch.risks.length > 0) ? `
            <h4 style="margin: 15px 0 5px 0; font-size: 12px; color: #ff5555;">Detected Risks:</h4>
            <ul style="font-size: 12px; color: #ccc; margin: 0 0 15px 0; padding-left: 20px;">
                ${patch.risks.map(r => `<li>${r}</li>`).join('')}
            </ul>
        ` : '';

        this.container.innerHTML = `
            <h2 style="margin-top: 0;">Proposed Change</h2>
            <h3 style="font-size: 14px; color: cyan; margin-bottom: 15px;">${patch.summary}</h3>

            <div style="margin-bottom: 20px;">
                ${filesHtml}
            </div>

            ${commandsHtml}
            ${risksHtml}

            <div style="display: flex; gap: 10px; border-top: 1px solid #444; padding-top: 15px;">
                <button id="diff-apply-btn" style="padding: 6px 15px; background: #4CAF50; color: white; border: none; cursor: pointer;">Apply Changes</button>
                <button id="diff-reject-btn" style="padding: 6px 15px; background: #ff5555; color: white; border: none; cursor: pointer;">Reject</button>
            </div>
        `;

        const attach = (selector: string, cb: (el: Element) => void) => {
            const el = this.container.querySelector(selector);
            if (el) el.addEventListener('click', () => cb(el));
        };

        attach('#diff-apply-btn', async (btn: any) => {
            btn.disabled = true;
            btn.innerText = 'Applying...';
            try {
                const res = await this.codegenService.applyPatch(patch.id);
                if (res.success) {
                    this.currentPatch = null;
                    this.render();

                    // Restart preview to catch new changes and let doctor kick in
                    if (this.workspaceService.workspace) {
                        await this.previewService.restartPreview(this.workspaceService.workspace.resource.toString());
                    }
                } else {
                    alert(`Failed to apply patch: ${res.error}`);
                }
            } catch (err) {
                alert(`Error: ${String(err)}`);
            } finally {
                btn.disabled = false;
                btn.innerText = 'Apply Changes';
            }
        });

        attach('#diff-reject-btn', async (btn: any) => {
            btn.disabled = true;
            try {
                await this.codegenService.rejectPatch(patch.id);
                this.currentPatch = null;
                this.render();
            } catch (err) {
                alert(`Error: ${String(err)}`);
            }
        });
    }
}
