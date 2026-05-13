import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { ForgeScoutService, DiscoverySession, ProjectGeneratorService, BlueprintAnalysis, ProjectGenerationPlan } from '../common/protocol';
import { PrimaryActionButton, ActionCard } from '@localforge/ui';

export const ForgeScoutWidgetOptions = {
    id: 'forge-scout-widget',
    label: 'Forge Scout'
};

@injectable()
export class ForgeScoutWidget extends ReactWidget {

    @inject(ForgeScoutService)
    protected readonly forgeScoutService!: ForgeScoutService;

    @inject(ProjectGeneratorService)
    protected readonly projectGeneratorService!: ProjectGeneratorService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    private currentSession: DiscoverySession | null = null;
    private currentAnalysis: BlueprintAnalysis | null = null;
    private currentPlan: ProjectGenerationPlan | null = null;
    private step: number = 1;

    // Controlled inputs for Step 1
    private ideaValue: string = '';
    private goalValue: string = 'mvp';

    private isLoading = false;
    private saveResultMsg = '';

    constructor() {
        super();
        this.id = ForgeScoutWidgetOptions.id;
        this.title.label = ForgeScoutWidgetOptions.label;
        this.title.caption = ForgeScoutWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-compass';
        this.addClass('forge-scout-widget');
    }

    @postConstruct()
    protected async init(): Promise<void> {

        this.update();
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.update();
    }

    private reset() {
        this.currentSession = null;
        this.currentAnalysis = null;
        this.currentPlan = null;
        this.saveResultMsg = '';
        this.step = 1;
        this.update();
    }

    protected render(): React.ReactNode {
        return (
            <div style={{ padding: '15px', color: '#ccc', fontSize: '13px', overflowY: 'auto', height: '100%' }}>
                {this.step === 1 && this.renderStep1()}
                {this.step === 2 && this.renderStep2()}
                {this.step === 3 && this.renderStep3()}
                {this.step === 4 && this.renderStep4()}
                {this.step === 5 && this.renderStep5()}
            </div>
        );
    }

    private renderStep1() {
        return (
            <>
                <h2 style={{ marginTop: 0, color: 'white' }}>Forge Scout</h2>
                <p style={{ color: '#ccc', fontSize: '12px' }}>Let's transform your idea into a concrete app blueprint.</p>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>What are you trying to do?</label>
                    <select
                        value={this.goalValue}
                        onChange={(e) => { this.goalValue = e.target.value; this.update(); }}
                        style={{ width: '100%', padding: '5px', background: '#333', color: 'white', border: '1px solid #555' }}
                    >
                        <option value="validate">Validate an idea</option>
                        <option value="prototype">Build a prototype</option>
                        <option value="mvp">Build an MVP</option>
                        <option value="launch">Launch a business</option>
                        <option value="improve">Improve an existing app</option>
                    </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>Describe your idea:</label>
                    <textarea
                        rows={4}
                        placeholder="e.g. I want to build an app for mobile car detailers..."
                        value={this.ideaValue}
                        onChange={(e) => { this.ideaValue = e.target.value; this.update(); }}
                        style={{ width: '100%', padding: '5px', background: '#333', color: 'white', border: '1px solid #555', resize: 'vertical' }}
                    />
                </div>

                <PrimaryActionButton disabled={this.isLoading} onClick={async () => {
                    if (!this.ideaValue.trim()) return alert("Please enter an idea.");
                    this.isLoading = true;
                    this.update();
                    try {
                        this.currentSession = await this.forgeScoutService.createDiscoverySession({
                            idea: this.ideaValue, goal: this.goalValue as any, researchDepth: 'standard'
                        });
                        this.currentSession.productOptions = await this.forgeScoutService.generateProductOptions(this.currentSession.sessionId);
                        this.step = 2;
                    } catch (err) {
                        alert(`Error: ${String(err)}`);
                    } finally {
                        this.isLoading = false;
                        this.update();
                    }
                }}>
                    {this.isLoading ? 'Scouting...' : 'Scout Options'}
                </PrimaryActionButton>
            </>
        );
    }

    private renderStep2() {
        return (
            <>
                <h2 style={{ marginTop: 0, color: 'white' }}>Product Options</h2>
                <p style={{ color: '#ccc', fontSize: '12px' }}>Select an approach to generate blueprints.</p>
                {this.isLoading ? (
                    <p style={{ color: 'cyan' }}>Generating Blueprints...</p>
                ) : (
                    <>
                        {this.currentSession?.productOptions?.map(opt => (
                            <ActionCard
                                key={opt.id}
                                title={`${opt.title} ${opt.recommended ? '(Recommended)' : ''}`}
                                borderColor={opt.recommended ? '#4CAF50' : '#444'}
                                description={opt.description}
                                onClick={async () => {
                                    this.isLoading = true;
                                    this.update();
                                    try {
                                        await this.forgeScoutService.selectProductOption(this.currentSession!.sessionId, opt.id);
                                        this.currentSession!.businessBlueprint = await this.forgeScoutService.generateBusinessBlueprint(this.currentSession!.sessionId);
                                        this.currentSession!.appBlueprint = await this.forgeScoutService.generateAppBlueprint(this.currentSession!.sessionId);
                                        this.step = 3;
                                    } catch(err) {
                                        alert(`Error: ${String(err)}`);
                                    } finally {
                                        this.isLoading = false;
                                        this.update();
                                    }
                                }}
                            >
                                <div style={{ fontSize: '10px', color: '#888' }}>Target: {opt.targetCustomer} | Build: {opt.buildComplexity}</div>
                            </ActionCard>
                        ))}
                        <PrimaryActionButton variant="secondary" onClick={() => { this.step = 1; this.update(); }}>Back</PrimaryActionButton>
                    </>
                )}
            </>
        );
    }

    private renderStep3() {
        const bb = this.currentSession?.businessBlueprint;
        const ab = this.currentSession?.appBlueprint;
        if (!bb || !ab) return null;

        return (
            <>
                <h2 style={{ marginTop: 0, color: 'white' }}>Blueprints Ready</h2>

                <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid #007acc' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: 'white' }}>Business Scope: {bb.productName}</h3>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>
                        <strong>Value Prop:</strong> {bb.valueProposition}<br/>
                        <strong>Target:</strong> {bb.targetCustomer}<br/>
                        <strong>Models:</strong> {bb.businessModelOptions.join(', ')}<br/>
                    </div>
                </div>

                <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid #4CAF50' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: 'white' }}>Tech Blueprint</h3>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>
                        <strong>Stack:</strong> {ab.recommendedStack.join(', ')}<br/>
                        <strong>Pages:</strong> {ab.pages.length}<br/>
                        <strong>DB Entities:</strong> {ab.databaseEntities.length}<br/>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <PrimaryActionButton disabled={this.isLoading || !!this.saveResultMsg} onClick={async () => {
                        if (!this.workspaceService.workspace) return alert("Please open a workspace folder first.");
                        this.isLoading = true;
                        this.update();
                        try {
                            const rootUri = this.workspaceService.workspace.resource.toString();
                            const res = await this.forgeScoutService.saveBlueprintToWorkspace(this.currentSession!.sessionId, rootUri);
                            if (res.success) {
                                this.saveResultMsg = `Successfully saved files to /docs!`;
                            } else {
                                alert(`Failed to save: ${res.error}`);
                            }
                        } catch (err) {
                            alert(`Error: ${String(err)}`);
                        } finally {
                            this.isLoading = false;
                            this.update();
                        }
                    }}>
                        {this.isLoading ? 'Saving...' : 'Save to Workspace'}
                    </PrimaryActionButton>
                    <PrimaryActionButton variant="secondary" onClick={() => this.reset()}>Start Over</PrimaryActionButton>
                </div>

                {this.saveResultMsg && (
                    <div style={{ marginTop: '15px' }}>
                        <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '10px' }}>{this.saveResultMsg}</div>
                        <PrimaryActionButton style={{ background: '#4CAF50' }} onClick={async () => {
                            try {
                                this.isLoading = true;
                                this.update();
                                const rootUri = this.workspaceService.workspace!.resource.toString();
                                this.currentAnalysis = await this.projectGeneratorService.analyzeBlueprint(rootUri);
                                this.currentPlan = await this.projectGeneratorService.getGenerationPlan({
                                    workspaceRootUri: rootUri,
                                    targetDir: 'apps/web',
                                    analysis: this.currentAnalysis
                                });
                                this.step = 4;
                            } catch (analyzeErr) {
                                alert(String(analyzeErr));
                            } finally {
                                this.isLoading = false;
                                this.update();
                            }
                        }}>Proceed to Project Generation</PrimaryActionButton>
                    </div>
                )}
            </>
        );
    }

    private renderStep4() {
        const analysis = this.currentAnalysis;
        const plan = this.currentPlan;
        if (!analysis || !plan) return null;

        return (
            <>
                <h2 style={{ marginTop: 0, color: 'white' }}>Project Generator</h2>
                <p style={{ color: '#ccc', fontSize: '12px' }}>Review the generation plan based on your App Blueprint.</p>

                <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid #007acc' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: 'white' }}>App Architecture</h3>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>
                        <strong>Recommended Stack:</strong><br/>
                        {analysis.recommendedStack.join(' + ')}
                    </div>
                </div>

                <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid #FF9800' }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: 'white' }}>Generation Plan</h3>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>
                        <strong>Target Directory:</strong> <code>/{plan.targetDir}</code><br/>
                        <strong>Files to Scaffold:</strong> {plan.filesToCreate.length}<br/><br/>
                        <strong>Highlights:</strong>
                        <ul style={{ marginTop: '5px', paddingLeft: '15px' }}>
                            {analysis.pages.slice(0,3).map(p => <li key={p}>Page: {p}</li>)}
                            {analysis.components.slice(0,3).map(c => <li key={c}>Comp: {c}</li>)}
                            {analysis.apiRoutes.slice(0,2).map(a => <li key={a}>API: {a}</li>)}
                            {(analysis.pages.length > 3 || analysis.components.length > 3) && <li>...and more</li>}
                        </ul>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <PrimaryActionButton disabled={this.isLoading} style={{ background: '#4CAF50' }} onClick={async () => {
                        this.isLoading = true;
                        this.update();
                        try {
                            const rootUri = this.workspaceService.workspace!.resource.toString();
                            const result = await this.projectGeneratorService.generateProject({
                                workspaceRootUri: rootUri,
                                targetDir: plan.targetDir,
                                analysis: analysis
                            });
                            if (result.success) {
                                this.step = 5;
                            } else {
                                alert(`Generation failed: ${result.error}`);
                            }
                        } catch (err) {
                            alert(`Error: ${String(err)}`);
                        } finally {
                            this.isLoading = false;
                            this.update();
                        }
                    }}>
                        {this.isLoading ? 'Scaffolding...' : 'Generate Project Scaffold'}
                    </PrimaryActionButton>
                    <PrimaryActionButton variant="secondary" onClick={() => { this.step = 3; this.update(); }}>Back</PrimaryActionButton>
                </div>
            </>
        );
    }

    private renderStep5() {
        return (
            <>
                <h2 style={{ marginTop: 0, color: '#4CAF50' }}>Project Generated!</h2>
                <p style={{ fontSize: '12px', color: '#ccc', marginBottom: '20px' }}>
                    Your Next.js starter application has been successfully scaffolded inside <code>/apps/web</code>.
                </p>
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'white' }}>Next Steps</h3>
                    <ol style={{ fontSize: '12px', color: '#ccc', paddingLeft: '20px', margin: 0 }}>
                        <li style={{ marginBottom: '5px' }}>Open a new terminal</li>
                        <li style={{ marginBottom: '5px' }}>Run <code>cd apps/web && pnpm install</code></li>
                        <li style={{ marginBottom: '5px' }}>Run <code>npm run dev</code> to start the development server</li>
                        <li>Use LocalForge Preview to view the app directly in the IDE.</li>
                    </ol>
                </div>
                <PrimaryActionButton onClick={() => this.reset()}>Done</PrimaryActionButton>
            </>
        );
    }
}
