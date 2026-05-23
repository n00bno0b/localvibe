import { ProjectIndexerService } from '../common/protocol';
import { injectable, inject } from '@theia/core/shared/inversify';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from '@theia/core';
import {
    AICodegenService,
    CodegenRequest,
    CodegenPlan,
    GeneratedPatch,
    ApplyPatchResult,
    AIProviderRegistry
} from '../../../local-brain/src/common/protocol';
import { CodegenPromptBuilder } from './utils/prompt-builder';

@injectable()
export class AICodegenServiceImpl implements AICodegenService {

    @inject(AIProviderRegistry)
    protected readonly aiRegistry!: AIProviderRegistry;

    @inject(ProjectIndexerService)
    protected readonly indexerService!: ProjectIndexerService;

    private plans = new Map<string, CodegenPlan>();
    private patches = new Map<string, GeneratedPatch>();

    private updateProjectState(workspaceRoot: string, task: string, risk?: string) {
        const p = path.join(workspaceRoot, '.localforge', 'project-state.json');
        try {
            if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), { recursive: true });
            let state: any = { phase: 'mvp-build', knownRisks: [], nextRecommendedAction: '' };
            if (fs.existsSync(p)) {
                state = JSON.parse(fs.readFileSync(p, 'utf8'));
            }

            state.lastCompletedTask = task;
            if (risk) state.knownRisks.push(risk);

            fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
        } catch (e) {
            console.error("Failed to update project-state.json", e);
        }
    }

    public async createEditPlan(input: CodegenRequest): Promise<CodegenPlan> {
        const id = `plan_${Date.now()}`;
        const rootUri = new URI(input.workspacePath);
        const rootPath = rootUri.path.toString();

        // 1. Gather Context
        const contextGathered: string[] = [];

        const bpPath = path.join(rootPath, 'docs', 'app-blueprint.md');
        if (fs.existsSync(bpPath)) contextGathered.push('docs/app-blueprint.md');

        const pkgPath = path.join(rootPath, input.appPath, 'package.json');
        if (fs.existsSync(pkgPath)) contextGathered.push(`${input.appPath}/package.json`);

        const statePath = path.join(rootPath, '.localforge', 'project-state.json');
        if (fs.existsSync(statePath)) contextGathered.push('.localforge/project-state.json');

        // Dynamically discover relevant project files using Semantic/Keyword Indexer
        try {
            // Ensure index is built (in a real app this would run on project load)
            const indexStatus = await this.indexerService.getIndexStatus(rootUri.toString());
            if (indexStatus.state === 'idle' || indexStatus.filesIndexed === 0) {
                await this.indexerService.indexWorkspace(rootUri.toString());
            }

            const searchResults = await this.indexerService.search(rootUri.toString(), input.userPrompt, 3);
            for (const res of searchResults) {
                if (!contextGathered.includes(res.filePath)) {
                    contextGathered.push(res.filePath);
                }
            }
        } catch (e) {
            console.error("Failed to execute project indexer search", e);
        }

        const plan: CodegenPlan = {
            id,
            request: input,
            contextGathered,
            status: 'ready'
        };

        this.plans.set(id, plan);
        return plan;
    }

    public async generatePatch(planId: string): Promise<GeneratedPatch> {
        const plan = this.plans.get(planId);
        if (!plan) throw new Error('Plan not found');

        const rootUri = new URI(plan.request.workspacePath);
        const rootPath = rootUri.path.toString();

        const systemPrompt = CodegenPromptBuilder.buildSystemPrompt(rootPath, plan.request.appPath, plan.contextGathered);

        const requestPayload = {
            sessionId: `codegen_${planId}`,
            messages: [
                { role: 'system' as const, content: systemPrompt },
                { role: 'user' as const, content: plan.request.userPrompt }
            ]
        };

        let rawResponse = '';
        try {
            // Forward request to AI Provider Registry
            rawResponse = await this.aiRegistry.chat(requestPayload);
        } catch (error) {
            console.error("Provider failed. Trying Mock fallback...", error);
            // Fallback to mock provider explicitly if connection/runtime isn't ready
            rawResponse = await this.aiRegistry.chat(requestPayload, 'mock-provider');
        }

        const patch = CodegenPromptBuilder.parseJsonPatch(rawResponse);
        this.patches.set(patch.id, patch);

        return patch;
    }

    public async applyPatch(patchId: string): Promise<ApplyPatchResult> {
        const patch = this.patches.get(patchId);
        if (!patch) throw new Error('Patch not found');

        // We fallback to cwd if we can't reliably resolve the plan, but in a real system patch objects
        // should carry their workspace root URI directly.
        const rootPath = new URI(process.cwd()).path.toString();

        let filesModified = 0;

        try {
            for (const file of patch.files) {
                const fullPath = path.join(rootPath, file.path);

                if (file.action === 'create' || file.action === 'modify') {
                    if (!file.after) throw new Error(`Missing 'after' content for file ${file.path}`);

                    if (!fs.existsSync(path.dirname(fullPath))) {
                        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    }

                    if (file.action === 'modify' && file.before) {
                        // Very naive search and replace
                        if (fs.existsSync(fullPath)) {
                            let existingContent = fs.readFileSync(fullPath, 'utf8');
                            existingContent = existingContent.replace(file.before, file.after);
                            fs.writeFileSync(fullPath, existingContent, 'utf8');
                        } else {
                            fs.writeFileSync(fullPath, file.after, 'utf8'); // fallback to create
                        }
                    } else {
                        // Create or full replace
                        fs.writeFileSync(fullPath, file.after, 'utf8');
                    }
                    filesModified++;

                } else if (file.action === 'delete') {
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                        filesModified++;
                    }
                }
            }

            this.updateProjectState(rootPath, patch.summary, patch.risks[0]);
            this.patches.delete(patchId);

            return { success: true, filesModified };
        } catch (e) {
            return { success: false, filesModified, error: String(e) };
        }
    }

    public async rejectPatch(patchId: string): Promise<void> {
        const patch = this.patches.get(patchId);
        if (patch) {
            const rootPath = new URI(process.cwd()).path.toString();
            this.updateProjectState(rootPath, `Rejected proposed patch: ${patch.summary}`);
            this.patches.delete(patchId);
        }
    }

    public async getActivePatch(): Promise<GeneratedPatch | null> {
        if (this.patches.size === 0) return null;
        return this.patches.values().next().value;
    }
}
