import { Event } from '@theia/core/lib/common/event';
export declare const ForgeScoutServicePath = "/services/forge-scout";
export interface DiscoveryInput {
    idea: string;
    goal: 'validate' | 'prototype' | 'mvp' | 'launch' | 'improve';
    researchDepth: 'quick' | 'standard' | 'deep';
}
export interface ProductOption {
    id: string;
    title: string;
    description: string;
    targetCustomer: string;
    difficulty: 'low' | 'medium' | 'high';
    validationRisk: 'low' | 'medium' | 'high';
    buildComplexity: 'prototype' | 'mvp' | 'platform';
    recommended: boolean;
}
export interface ClarifyingAnswer {
    questionId: string;
    answer: string;
}
export interface BusinessBlueprint {
    productName?: string;
    targetCustomer: string;
    problemStatement: string;
    valueProposition: string;
    mvpScope: string[];
    businessModelOptions: string[];
    validationPlan: string[];
    launchChecklist: string[];
    risks: string[];
}
export interface AppBlueprint {
    appType: 'marketplace' | 'saas' | 'booking' | 'ecommerce' | 'social' | 'internal-tool' | 'custom';
    pages: string[];
    components: string[];
    databaseEntities: string[];
    apiRoutes: string[];
    integrations: string[];
    workflows: string[];
    recommendedStack: string[];
}
export interface DiscoverySession {
    sessionId: string;
    input: DiscoveryInput;
    productOptions?: ProductOption[];
    selectedOptionId?: string;
    businessBlueprint?: BusinessBlueprint;
    appBlueprint?: AppBlueprint;
}
export interface SavedBlueprintResult {
    success: boolean;
    filesSaved: string[];
    error?: string;
}
export declare const ForgeScoutService: unique symbol;
export interface ForgeScoutService {
    createDiscoverySession(input: DiscoveryInput): Promise<DiscoverySession>;
    generateProductOptions(sessionId: string): Promise<ProductOption[]>;
    selectProductOption(sessionId: string, optionId: string): Promise<DiscoverySession>;
    answerClarifyingQuestion(sessionId: string, answer: ClarifyingAnswer): Promise<DiscoverySession>;
    generateBusinessBlueprint(sessionId: string): Promise<BusinessBlueprint>;
    generateAppBlueprint(sessionId: string): Promise<AppBlueprint>;
    saveBlueprintToWorkspace(sessionId: string, workspaceRootUri: string): Promise<SavedBlueprintResult>;
}
export declare const ProjectGeneratorServicePath = "/services/project-generator";
export interface BlueprintAnalysis {
    appType: string;
    pages: string[];
    components: string[];
    apiRoutes: string[];
    databaseEntities: string[];
    recommendedStack: string[];
    rawContent: string;
}
export interface ProjectGenerationPlan {
    targetDir: string;
    stack: string[];
    directoriesToCreate: string[];
    filesToCreate: {
        path: string;
        description: string;
    }[];
}
export interface GenerateProjectInput {
    workspaceRootUri: string;
    targetDir: string;
    analysis: BlueprintAnalysis;
}
export interface ProjectGenerationResult {
    success: boolean;
    generatedFilesCount: number;
    targetDir: string;
    error?: string;
}
export declare const ProjectGeneratorService: unique symbol;
export interface ProjectGeneratorService {
    analyzeBlueprint(workspaceRootUri: string): Promise<BlueprintAnalysis>;
    getGenerationPlan(input: GenerateProjectInput): Promise<ProjectGenerationPlan>;
    generateProject(input: GenerateProjectInput): Promise<ProjectGenerationResult>;
}
export declare const PreviewServicePath = "/services/preview";
export type PreviewState = 'stopped' | 'installing_dependencies' | 'starting_server' | 'waiting_for_localhost' | 'running' | 'crashed' | 'missing_package_manager' | 'port_unavailable' | 'missing_directory';
export interface PreviewStatus {
    state: PreviewState;
    url?: string;
    message?: string;
}
export interface PreviewLogEvent {
    type: 'stdout' | 'stderr' | 'system';
    message: string;
    timestamp: number;
}
export declare const PreviewService: unique symbol;
export interface PreviewService {
    readonly onStateChange: Event<PreviewStatus>;
    readonly onLog: Event<PreviewLogEvent>;
    getStatus(): Promise<PreviewStatus>;
    startPreview(workspaceRootUri: string): Promise<void>;
    stopPreview(): Promise<void>;
    restartPreview(workspaceRootUri: string): Promise<void>;
}
export declare const DependencyDoctorServicePath = "/services/dependency-doctor";
export type FixActionType = 'install_package' | 'add_env_placeholder' | 'human_action_required' | 'unknown';
export interface FixAction {
    type: FixActionType;
    payload?: any;
    description: string;
    isSafeAutoFix: boolean;
}
export interface DetectedIssue {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    rawLog: string;
    issueSummary: string;
    explanation: string;
    likelyCause: string;
    suggestedFix: string;
    action: FixAction;
    confidenceScore: number;
}
export interface DiagnosticReport {
    issues: DetectedIssue[];
    timestamp: number;
}
export interface AnalyzeLogsInput {
    workspaceRootUri: string;
    logs: PreviewLogEvent[];
}
export interface FixResult {
    success: boolean;
    issueId: string;
    message: string;
    error?: string;
}
export declare const DependencyDoctorService: unique symbol;
export interface DependencyDoctorService {
    readonly onIssuesUpdated: Event<DetectedIssue[]>;
    analyzeLogs(input: AnalyzeLogsInput): Promise<DiagnosticReport>;
    listActiveIssues(workspaceRootUri: string): Promise<DetectedIssue[]>;
    applyFix(workspaceRootUri: string, issueId: string): Promise<FixResult>;
    dismissIssue(workspaceRootUri: string, issueId: string): Promise<void>;
}
export declare const AICodegenServicePath = "/services/ai-codegen";
export interface CodegenRequest {
    workspacePath: string;
    appPath: string;
    userPrompt: string;
    targetFiles?: string[];
    mode: 'small-edit' | 'component' | 'page' | 'api-route' | 'bugfix' | 'refactor';
    safetyLevel: 'suggest-only' | 'diff-required';
}
export interface FilePatch {
    path: string;
    action: 'create' | 'modify' | 'delete';
    before?: string;
    after?: string;
}
export interface CommandPatch {
    command: string;
    reason: string;
    requiresApproval: boolean;
}
export interface GeneratedPatch {
    id: string;
    summary: string;
    files: FilePatch[];
    commands?: CommandPatch[];
    risks: string[];
}
export interface CodegenPlan {
    id: string;
    request: CodegenRequest;
    contextGathered: string[];
    status: 'analyzing' | 'generating' | 'ready';
}
export interface ApplyPatchResult {
    success: boolean;
    filesModified: number;
    error?: string;
}
export declare const AICodegenService: unique symbol;
export interface AICodegenService {
    createEditPlan(input: CodegenRequest): Promise<CodegenPlan>;
    generatePatch(planId: string): Promise<GeneratedPatch>;
    applyPatch(patchId: string): Promise<ApplyPatchResult>;
    rejectPatch(patchId: string): Promise<void>;
}
//# sourceMappingURL=protocol.d.ts.map