import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { PreviewService } from '../common/protocol';
import { AICodegenService, GeneratedPatch } from '../../../local-brain/src/common/protocol';
import { PrimaryActionButton, EmptyState } from '@localforge/ui';

export const CodegenDiffWidgetOptions = {
    id: 'localforge-codegen-diff-widget',
    label: 'Code Diff Approval'
};

@injectable()
export class CodegenDiffWidget extends ReactWidget {

    @inject(AICodegenService)
    protected readonly codegenService!: AICodegenService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(PreviewService)
    protected readonly previewService!: PreviewService;

    private currentPatch: GeneratedPatch | null = null;
    private isApplying = false;

    constructor() {
        super();
        this.id = CodegenDiffWidgetOptions.id;
        this.title.label = CodegenDiffWidgetOptions.label;
        this.title.caption = CodegenDiffWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-code-fork';
        this.addClass('localforge-codegen-diff-widget');
    }

    @postConstruct()
    protected async init(): Promise<void> {

        this.currentPatch = await this.codegenService.getActivePatch();
        this.update();
    }

    protected override async onUpdateRequest(msg: Message): Promise<void> {
        super.onUpdateRequest(msg);
        const patch = await this.codegenService.getActivePatch();
        if (patch) {
            this.currentPatch = patch;
        }
        this.update();
    }

    protected render(): React.ReactNode {
        if (!this.currentPatch) {
            return <EmptyState iconClass="fa-code" title="No Active Code Changes" description="Ask Local Brain to generate a feature to review diffs here." />;
        }

        const patch = this.currentPatch;

        return (
            <div style={{ padding: '15px', color: '#ccc', fontSize: '13px' }}>
                <h2 style={{ marginTop: 0 }}>Proposed Change</h2>
                <h3 style={{ fontSize: '14px', color: 'cyan', marginBottom: '15px' }}>{patch.summary}</h3>

                <div style={{ marginBottom: '20px' }}>
                    {patch.files.map((f, i) => {
                        const isMod = f.action === 'modify';
                        const isAdd = f.action === 'create';
                        const color = isMod ? '#007acc' : isAdd ? '#4CAF50' : '#ff5555';

                        return (
                            <div key={i} style={{ marginBottom: '15px', border: '1px solid #444', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '5px 10px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between' }}>
                                    <strong style={{ color, fontSize: '12px' }}>{f.action.toUpperCase()} {f.path}</strong>
                                </div>
                                {f.before && (
                                    <div style={{ background: '#2b0000', padding: '10px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#ff8888' }}>
                                        - {f.before.substring(0, 100)}...
                                    </div>
                                )}
                                {f.after && (
                                    <div style={{ background: '#002b00', padding: '10px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#88ff88' }}>
                                        + {f.after.substring(0, 250)}...
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {patch.commands && patch.commands.length > 0 && (
                    <>
                        <h4 style={{ margin: '15px 0 5px 0', fontSize: '12px', color: '#FF9800' }}>Required Commands:</h4>
                        <ul style={{ fontSize: '12px', color: '#ccc', margin: '0 0 15px 0', paddingLeft: '20px' }}>
                            {patch.commands.map((c, i) => (
                                <li key={i}>
                                    <code>{c.command}</code><br/>
                                    <small style={{ color: '#888' }}>Reason: {c.reason}</small>
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                {patch.risks && patch.risks.length > 0 && (
                    <>
                        <h4 style={{ margin: '15px 0 5px 0', fontSize: '12px', color: '#ff5555' }}>Detected Risks:</h4>
                        <ul style={{ fontSize: '12px', color: '#ccc', margin: '0 0 15px 0', paddingLeft: '20px' }}>
                            {patch.risks.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </>
                )}

                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #444', paddingTop: '15px' }}>
                    <PrimaryActionButton disabled={this.isApplying} style={{ background: '#4CAF50' }} onClick={async () => {
                        this.isApplying = true;
                        this.update();
                        try {
                            const res = await this.codegenService.applyPatch(patch.id);
                            if (res.success) {
                                this.currentPatch = null;
                                if (this.workspaceService.workspace) {
                                    await this.previewService.restartPreview(this.workspaceService.workspace.resource.toString());
                                }
                            } else {
                                alert(`Failed to apply patch: ${res.error}`);
                            }
                        } catch (err) {
                            alert(`Error: ${String(err)}`);
                        } finally {
                            this.isApplying = false;
                            this.update();
                        }
                    }}>
                        {this.isApplying ? 'Applying...' : 'Apply Changes'}
                    </PrimaryActionButton>

                    <PrimaryActionButton variant="danger" disabled={this.isApplying} onClick={async () => {
                        try {
                            await this.codegenService.rejectPatch(patch.id);
                            this.currentPatch = null;
                            this.update();
                        } catch (err) {
                            alert(`Error: ${String(err)}`);
                        }
                    }}>
                        Reject
                    </PrimaryActionButton>
                </div>
            </div>
        );
    }
}
