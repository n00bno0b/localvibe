import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget, Message } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { ForgeScoutService, DiscoverySession } from '../common/protocol';

export const ForgeScoutWidgetOptions = {
    id: 'forge-scout-widget',
    label: 'Forge Scout'
};

@injectable()
export class ForgeScoutWidget extends BaseWidget {

    @inject(ForgeScoutService)
    protected readonly forgeScoutService!: ForgeScoutService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    private container: HTMLDivElement;
    private currentSession: DiscoverySession | null = null;
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
                await this.forgeScoutService.generateProductOptions(this.currentSession.sessionId);

                // Fetch the updated session state to get the options
                // In our implementation generateProductOptions mutates internal state but we should arguably pass them.
                // We'll just assume they are attached, or we can fetch them via a getter. For simplicity,
                // the generateProductOptions returns the array directly.
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
                    resultDiv.innerHTML = `Successfully saved ${res.filesSaved.length} files to /docs!<br/>Next: Use these docs to generate your project in Phase 3B.`;
                } else {
                    alert(`Failed to save: ${res.error}`);
                }
            } catch (err) {
                alert(`Error: ${String(err)}`);
            } finally {
                btn.disabled = false;
                btn.innerText = 'Save to Workspace';
            }
        });
    }
}
