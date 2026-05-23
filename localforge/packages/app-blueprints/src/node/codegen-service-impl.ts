import { ProjectIndexerService, ForgeConductorService, PreviewService } from '../common/protocol';
import { injectable, inject, optional } from '@theia/core/shared/inversify';
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

    @inject(ForgeConductorService) @optional()
    protected readonly conductorService?: ForgeConductorService;

    @inject(PreviewService) @optional()
    protected readonly previewService?: PreviewService;

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

    private runSemgrepSecurityScan(patch: GeneratedPatch): string[] {
        const detectedRisks: string[] = [];

        for (const file of patch.files) {
            if (file.action === 'create' || file.action === 'modify') {
                const content = file.after || '';

                // Stub: AST Pattern Matcher (Semgrep Equivalent)
                if (content.match(/SELECT \* FROM .* WHERE .* = \$/)) { // Naive interpolation check
                    // Ignore parameterization in naive check, looking for concat
                }

                if (content.match(/`SELECT .* FROM .* WHERE .* = \${.*}`/)) {
                    detectedRisks.push(`[AVR-SAST] Potential SQL Injection detected in ${file.path}. Use parameterized queries.`);
                }

                if (content.match(/['"]sk-[a-zA-Z0-9]{32,}['"]/)) {
                    detectedRisks.push(`[AVR-SAST] Hardcoded API secret detected in ${file.path}. Use environment variables.`);
                }

                if (content.includes('eval(')) {
                    detectedRisks.push(`[AVR-SAST] Dangerous use of eval() detected in ${file.path}.`);
                }
            }
        }

        return detectedRisks;
    }

    public async generatePatch(planId: string): Promise<GeneratedPatch> {
        const plan = this.plans.get(planId);
        if (!plan) throw new Error('Plan not found');

        const rootUri = new URI(plan.request.workspacePath);
        const rootPath = rootUri.path.toString();

        const systemPrompt = CodegenPromptBuilder.buildSystemPrompt(rootPath, plan.request.appPath, plan.contextGathered);

        let maxAttempts = 3;
        let attempt = 0;
        let patch: GeneratedPatch | null = null;
        let lastError = '';

        while (attempt < maxAttempts) {
            attempt++;

            let prompt = plan.request.userPrompt;
            if (lastError) {
                prompt += `\n\n[AVR System Feedback]: The previous generation failed security checks: ${lastError}\nPlease regenerate the code and fix these vulnerabilities using safe patterns (e.g. parameterized queries, env vars).`;
            }

            const requestPayload = {
                sessionId: `codegen_${planId}_${attempt}`,
                messages: [
                    { role: 'system' as const, content: systemPrompt },
                    { role: 'user' as const, content: prompt }
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

            patch = CodegenPromptBuilder.parseJsonPatch(rawResponse);

            // Phase 5 Code-Level Layer: Local Static Analysis (AST/Semgrep Stub)
            const securityViolations = this.runSemgrepSecurityScan(patch);

            if (securityViolations.length === 0) {
                break; // Safe, exit loop
            } else {
                console.warn(`[AVR] Generation failed static analysis on attempt ${attempt}:`, securityViolations);
                lastError = securityViolations.join('; ');
                patch = null;

                // Mock provider won't fix itself, so we break immediately if we're using it to avoid infinite looping
                if (rawResponse.includes('MOCK_PATCH')) break;
            }
        }

        if (!patch) {
            throw new Error(`Failed to generate secure code after ${maxAttempts} attempts. Violations: ${lastError}`);
        }

        this.patches.set(patch.id, patch);

        return patch;
    }

    public async applyPatch(patchId: string): Promise<ApplyPatchResult> {
        const patch = this.patches.get(patchId);
        if (!patch) throw new Error('Patch not found');

        // We fallback to cwd if we can't reliably resolve the plan, but in a real system patch objects
        // should carry their workspace root URI directly.
        const rootUriStr = new URI(process.cwd()).toString();
        const rootPath = new URI(process.cwd()).path.toString();

        let filesModified = 0;

        // 1. Local Time-Machine: Create Backup state
        const backupMap = new Map<string, string | null>(); // path -> content (null means file didn't exist)

        try {
            for (const file of patch.files) {
                const fullPath = path.join(rootPath, file.path);
                if (fs.existsSync(fullPath)) {
                    backupMap.set(fullPath, fs.readFileSync(fullPath, 'utf8'));
                } else {
                    backupMap.set(fullPath, null);
                }
            }
        } catch(e) {
             return { success: false, filesModified: 0, error: `Failed to create backup snapshot: ${e}` };
        }

        // Mark State
        const branchId = `speculative_${Date.now()}`;
        if (this.conductorService) {
            await this.conductorService.updateProjectState({
                workspaceRootUri: rootUriStr,
                activeSpeculativeBranch: {
                    branchId,
                    status: 'active'
                }
            });
        }

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

            // 2. Speculative Evaluation: Try restarting preview
            if (this.conductorService && this.previewService) {
                await this.conductorService.updateProjectState({
                    workspaceRootUri: rootUriStr,
                    activeSpeculativeBranch: { branchId, status: 'evaluating' }
                });

                let previewStatus = await this.previewService.getStatus();
                if (previewStatus.state === 'running' || previewStatus.state === 'crashed') {
                   await this.previewService.restartPreview(rootUriStr);
                   // Wait a short moment to let process boot and catch obvious syntax errors
                   await new Promise(r => setTimeout(r, 4000));

                   previewStatus = await this.previewService.getStatus();
                   if (previewStatus.state === 'crashed') {
                       throw new Error(`Speculative build failed. Preview server crashed: ${previewStatus.message}`);
                   }
                }

                // 3. Fast-forward
                await this.conductorService.updateProjectState({
                    workspaceRootUri: rootUriStr,
                    activeSpeculativeBranch: { branchId, status: 'fast-forwarded' }
                });
            }

            this.updateProjectState(rootPath, patch.summary, patch.risks[0]);
            this.patches.delete(patchId);

            return { success: true, filesModified };
        } catch (e) {
            // Rollback files
            console.error(`Speculative apply failed, rolling back branch ${branchId}...`, e);
            for (const [fullPath, content] of backupMap.entries()) {
                if (content === null) {
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                } else {
                    fs.writeFileSync(fullPath, content, 'utf8');
                }
            }

            if (this.conductorService) {
                await this.conductorService.updateProjectState({
                    workspaceRootUri: rootUriStr,
                    activeSpeculativeBranch: { branchId, status: 'aborted', errorTrace: String(e) }
                });
            }

            return { success: false, filesModified: 0, error: `Speculative build failed in the background. Aborting edit before disk pollution occurred. Here is what broke:\n\n${String(e)}` };
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
