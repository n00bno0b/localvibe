import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { ForgeScoutService, DiscoverySession, ProjectGeneratorService, BlueprintAnalysis, ProjectGenerationPlan } from '../common/protocol';

export const ForgeScoutWidgetOptions = {
    id: 'forge-scout-widget',
    label: 'Forge Scout'
};

@injectable()
export class ForgeScoutWidget extends BaseWidget {

    @inject(ForgeScoutService)
    protected readonly forgeScoutService!: ForgeScoutService;

    @inject(ProjectGeneratorService)
    protected readonly projectGeneratorService!: ProjectGeneratorService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    private container: HTMLDivElement;
    private currentSession: DiscoverySession | null = null;
    private currentAnalysis: BlueprintAnalysis | null = null;
    private currentPlan: ProjectGenerationPlan | null = null;
    private step: number = 1;

    constructor() {
        super();
        this.id = ForgeScoutWidgetOptions.id;
        this.title.label = ForgeScoutWidgetOptions.label;
        this.title.caption = ForgeScoutWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-compass';
        this.addClass('forge-scout-widget');

        this.container = document.createElement('div');
        this.container.style.padding = '15px';
        this.container.style.overflowY = 'auto';
        this.container.style.height = '100%';

        this.node.appendChild(this.container);
    }

    @postConstruct()
    protected async init(): Promise<void> {
        this.render();
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.render();
    }

    private render() {
        if (this.step === 1) this.renderStep1();
        else if (this.step === 2) this.renderStep2();
        else if (this.step === 3) this.renderStep3();
        else if (this.step === 4) this.renderStep4();
        else if (this.step === 5) this.renderStep5();
    }

    private renderStep1() {
        this.container.innerHTML = `
            <h2 style="margin-top: 0;">Forge Scout</h2>
            <p style="color: #ccc; font-size: 12px;">Let's transform your idea into a concrete app blueprint.</p>

            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 12px; margin-bottom: 5px;">What are you trying to do?</label>
                <select id="fs-goal" style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #555;">
                    <option value="validate">Validate an idea</option>
                    <option value="prototype">Build a prototype</option>
                    <option value="mvp" selected>Build an MVP</option>
                    <option value="launch">Launch a business</option>
                    <option value="improve">Improve an existing app</option>
                </select>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 12px; margin-bottom: 5px;">Describe your idea:</label>
                <textarea id="fs-idea" rows="4" placeholder="e.g. I want to build an app for mobile car detailers..." style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #555; resize: vertical;"></textarea>
            </div>

            <button id="fs-start-btn" style="padding: 6px 15px; background: #007acc; color: white; border: none; cursor: pointer;">Scout Options</button>
        `;

        const btn = this.container.querySelector('#fs-start-btn') as HTMLButtonElement;
        btn.onclick = async () => {
            const goal = (this.container.querySelector('#fs-goal') as HTMLSelectElement).value as any;
            const idea = (this.container.querySelector('#fs-idea') as HTMLTextAreaElement).value.trim();
            if (!idea) {
                alert("Please enter an idea.");
                return;
            }

            btn.innerText = 'Scouting...';
            btn.disabled = true;

            try {
                this.currentSession = await this.forgeScoutService.createDiscoverySession({
                    idea, goal, researchDepth: 'standard'
                });
                const opts = await this.forgeScoutService.generateProductOptions(this.currentSession.sessionId);
                this.currentSession.productOptions = opts;

                this.step = 2;
                this.render();
            } catch (err) {
                alert(`Error: ${String(err)}`);
                btn.innerText = 'Scout Options';
                btn.disabled = false;
            }
        };
    }

    private renderStep2() {
        if (!this.currentSession || !this.currentSession.productOptions) return;

        const optionsHtml = this.currentSession.productOptions.map(opt => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid ${opt.recommended ? '#4CAF50' : '#444'}; padding: 10px; margin-bottom: 10px; border-radius: 4px; cursor: pointer;" class="fs-opt-card" data-id="${opt.id}">
                <h4 style="margin: 0 0 5px 0; color: ${opt.recommended ? '#4CAF50' : 'white'};">
                    ${opt.title} ${opt.recommended ? '(Recommended)' : ''}
                </h4>
                <p style="font-size: 12px; margin: 0 0 5px 0; color: #ccc;">${opt.description}</p>
                <div style="font-size: 10px; color: #888;">
                    Target: ${opt.targetCustomer} | Build: ${opt.buildComplexity}
                </div>
            </div>
        `).join('');

        this.container.innerHTML = `
            <h2 style="margin-top: 0;">Product Options</h2>
            <p style="color: #ccc; font-size: 12px;">Select an approach to generate blueprints.</p>
            ${optionsHtml}
            <button id="fs-back-btn" style="margin-top: 10px; padding: 4px 10px; background: #555; color: white; border: none; cursor: pointer;">Back</button>
        `;

        this.container.querySelector('#fs-back-btn')!.addEventListener('click', () => {
            this.step = 1;
            this.render();
        });

        const cards = this.container.querySelectorAll('.fs-opt-card');
        cards.forEach(card => {
            card.addEventListener('click', async () => {
                const id = card.getAttribute('data-id');
                if (id && this.currentSession) {
                    this.container.innerHTML = `<h2 style="margin-top: 0;">Generating Blueprints...</h2><p>Please wait while LocalForge designs your application architecture and business scope.</p>`;
                    try {
                        await this.forgeScoutService.selectProductOption(this.currentSession.sessionId, id);
                        this.currentSession.businessBlueprint = await this.forgeScoutService.generateBusinessBlueprint(this.currentSession.sessionId);
                        this.currentSession.appBlueprint = await this.forgeScoutService.generateAppBlueprint(this.currentSession.sessionId);
                        this.step = 3;
                        this.render();
                    } catch(err) {
                        alert(`Error: ${String(err)}`);
                        this.step = 2;
                        this.render();
                    }
                }
            });
        });
    }

    private renderStep3() {
        if (!this.currentSession || !this.currentSession.businessBlueprint || !this.currentSession.appBlueprint) return;

        const bb = this.currentSession.businessBlueprint;
        const ab = this.currentSession.appBlueprint;

        this.container.innerHTML = `
            <h2 style="margin-top: 0;">Blueprints Ready</h2>

            <div style="margin-bottom: 20px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid #007acc;">
                <h3 style="margin: 0 0 5px 0; font-size: 14px;">Business Scope: ${bb.productName}</h3>
                <div style="font-size: 12px; color: #ccc;">
                    <strong>Value Prop:</strong> ${bb.valueProposition}<br/>
                    <strong>Target:</strong> ${bb.targetCustomer}<br/>
                    <strong>Models:</strong> ${bb.businessModelOptions.join(', ')}<br/>
                </div>
            </div>

            <div style="margin-bottom: 20px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid #4CAF50;">
                <h3 style="margin: 0 0 5px 0; font-size: 14px;">Tech Blueprint</h3>
                <div style="font-size: 12px; color: #ccc;">
                    <strong>Stack:</strong> ${ab.recommendedStack.join(', ')}<br/>
                    <strong>Pages:</strong> ${ab.pages.length}<br/>
                    <strong>DB Entities:</strong> ${ab.databaseEntities.length}<br/>
                </div>
            </div>

            <div style="display: flex; gap: 10px;">
                <button id="fs-save-btn" style="padding: 6px 15px; background: #007acc; color: white; border: none; cursor: pointer;">Save to Workspace</button>
                <button id="fs-reset-btn" style="padding: 6px 15px; background: #555; color: white; border: none; cursor: pointer;">Start Over</button>
            </div>
            <div id="fs-save-result" style="margin-top: 10px; font-size: 12px; color: #4CAF50;"></div>
        `;

        this.container.querySelector('#fs-reset-btn')!.addEventListener('click', () => {
            this.currentSession = null;
            this.step = 1;
            this.render();
        });

        this.container.querySelector('#fs-save-btn')!.addEventListener('click', async () => {
            if (!this.workspaceService.workspace) {
                alert("Please open a workspace folder first.");
                return;
            }

            const btn = this.container.querySelector('#fs-save-btn') as HTMLButtonElement;
            btn.disabled = true;
            btn.innerText = 'Saving...';

            try {
                const rootUri = this.workspaceService.workspace.resource.toString();
                const res = await this.forgeScoutService.saveBlueprintToWorkspace(this.currentSession!.sessionId, rootUri);

                if (res.success) {
                    const resultDiv = this.container.querySelector('#fs-save-result')!;
                    resultDiv.innerHTML = `Successfully saved files to /docs!<br/><br/>
                    <button id="fs-next-gen-btn" style="padding: 6px 15px; background: #4CAF50; color: white; border: none; cursor: pointer;">Proceed to Project Generation</button>`;

                    this.container.querySelector('#fs-next-gen-btn')!.addEventListener('click', async () => {
                        try {
                            this.container.innerHTML = `<h2 style="margin-top: 0;">Analyzing Blueprint...</h2>`;
                            this.currentAnalysis = await this.projectGeneratorService.analyzeBlueprint(rootUri);
                            this.currentPlan = await this.projectGeneratorService.getGenerationPlan({
                                workspaceRootUri: rootUri,
                                targetDir: 'apps/web',
                                analysis: this.currentAnalysis
                            });
                            this.step = 4;
                            this.render();
                        } catch (analyzeErr) {
                            alert(String(analyzeErr));
                            this.step = 3;
                            this.render();
                        }
                    });

                } else {
                    alert(`Failed to save: ${res.error}`);
                    btn.disabled = false;
                    btn.innerText = 'Save to Workspace';
                }
            } catch (err) {
                alert(`Error: ${String(err)}`);
                btn.disabled = false;
                btn.innerText = 'Save to Workspace';
            }
        });
    }

    private renderStep4() {
        if (!this.currentAnalysis || !this.currentPlan) return;

        const analysis = this.currentAnalysis;
        const plan = this.currentPlan;

        this.container.innerHTML = `
            <h2 style="margin-top: 0;">Project Generator</h2>
            <p style="color: #ccc; font-size: 12px;">Review the generation plan based on your App Blueprint.</p>

            <div style="margin-bottom: 20px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid #007acc;">
                <h3 style="margin: 0 0 5px 0; font-size: 14px;">App Architecture</h3>
                <div style="font-size: 12px; color: #ccc;">
                    <strong>Recommended Stack:</strong><br/>
                    ${analysis.recommendedStack.join(' + ')}
                </div>
            </div>

            <div style="margin-bottom: 20px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid #FF9800;">
                <h3 style="margin: 0 0 5px 0; font-size: 14px;">Generation Plan</h3>
                <div style="font-size: 12px; color: #ccc;">
                    <strong>Target Directory:</strong> <code>/${plan.targetDir}</code><br/>
                    <strong>Files to Scaffold:</strong> ${plan.filesToCreate.length}<br/><br/>
                    <strong>Highlights:</strong>
                    <ul style="margin-top: 5px; padding-left: 15px;">
                        ${analysis.pages.slice(0,3).map(p => `<li>Page: ${p}</li>`).join('')}
                        ${analysis.components.slice(0,3).map(c => `<li>Comp: ${c}</li>`).join('')}
                        ${analysis.apiRoutes.slice(0,2).map(a => `<li>API: ${a}</li>`).join('')}
                        ${(analysis.pages.length > 3 || analysis.components.length > 3) ? '<li>...and more</li>' : ''}
                    </ul>
                </div>
            </div>

            <button id="fs-gen-project-btn" style="padding: 6px 15px; background: #4CAF50; color: white; border: none; cursor: pointer;">Generate Project Scaffold</button>
            <button id="fs-back-plan-btn" style="margin-left: 10px; padding: 6px 15px; background: #555; color: white; border: none; cursor: pointer;">Back</button>
        `;

        this.container.querySelector('#fs-back-plan-btn')!.addEventListener('click', () => {
            this.step = 3;
            this.render();
        });

        this.container.querySelector('#fs-gen-project-btn')!.addEventListener('click', async () => {
            const btn = this.container.querySelector('#fs-gen-project-btn') as HTMLButtonElement;
            btn.disabled = true;
            btn.innerText = 'Scaffolding files...';

            try {
                const rootUri = this.workspaceService.workspace!.resource.toString();
                const result = await this.projectGeneratorService.generateProject({
                    workspaceRootUri: rootUri,
                    targetDir: plan.targetDir,
                    analysis: analysis
                });

                if (result.success) {
                    this.step = 5;
                    this.render();
                } else {
                    alert(`Generation failed: ${result.error}`);
                    btn.disabled = false;
                    btn.innerText = 'Generate Project Scaffold';
                }
            } catch (err) {
                alert(`Error: ${String(err)}`);
                btn.disabled = false;
                btn.innerText = 'Generate Project Scaffold';
            }
        });
    }

    private renderStep5() {
        this.container.innerHTML = `
            <h2 style="margin-top: 0; color: #4CAF50;">Project Generated!</h2>

            <p style="font-size: 12px; color: #ccc; margin-bottom: 20px;">
                Your Next.js starter application has been successfully scaffolded inside <code>/apps/web</code> based on your blueprints.
            </p>

            <div style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px;">Next Steps</h3>
                <ol style="font-size: 12px; color: #ccc; padding-left: 20px; margin: 0;">
                    <li style="margin-bottom: 5px;">Open a new terminal terminal</li>
                    <li style="margin-bottom: 5px;">Run <code>cd apps/web && pnpm install</code></li>
                    <li style="margin-bottom: 5px;">Run <code>npm run dev</code> to start the development server</li>
                    <li>Wait for Phase 3C (Live Preview) to view the app directly in the IDE.</li>
                </ol>
            </div>

            <button id="fs-finish-btn" style="padding: 6px 15px; background: #007acc; color: white; border: none; cursor: pointer;">Done</button>
        `;

        this.container.querySelector('#fs-finish-btn')!.addEventListener('click', () => {
            this.currentSession = null;
            this.currentAnalysis = null;
            this.currentPlan = null;
            this.step = 1;
            this.render();
        });
    }
}
