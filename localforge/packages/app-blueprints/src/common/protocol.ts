import { Event } from '@theia/core/lib/common/event';
export const ForgeScoutServicePath = '/services/forge-scout';

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

export const ForgeScoutService = Symbol('ForgeScoutService');

export interface ForgeScoutService {
    createDiscoverySession(input: DiscoveryInput): Promise<DiscoverySession>;
    generateProductOptions(sessionId: string): Promise<ProductOption[]>;
    selectProductOption(sessionId: string, optionId: string): Promise<DiscoverySession>;
    answerClarifyingQuestion(sessionId: string, answer: ClarifyingAnswer): Promise<DiscoverySession>;
    generateBusinessBlueprint(sessionId: string): Promise<BusinessBlueprint>;
    generateAppBlueprint(sessionId: string): Promise<AppBlueprint>;
    saveBlueprintToWorkspace(sessionId: string, workspaceRootUri: string): Promise<SavedBlueprintResult>;
}

// Phase 3B: Project Generator
export const ProjectGeneratorServicePath = '/services/project-generator';

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
    filesToCreate: { path: string, description: string }[];
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

export const ProjectGeneratorService = Symbol('ProjectGeneratorService');

export interface ProjectGeneratorService {
    analyzeBlueprint(workspaceRootUri: string): Promise<BlueprintAnalysis>;
    getGenerationPlan(input: GenerateProjectInput): Promise<ProjectGenerationPlan>;
    generateProject(input: GenerateProjectInput): Promise<ProjectGenerationResult>;
}

// Phase 3C: Live Preview Service
export const PreviewServicePath = '/services/preview';

export type PreviewState =
    | 'stopped'
    | 'installing_dependencies'
    | 'starting_server'
    | 'waiting_for_localhost'
    | 'running'
    | 'crashed'
    | 'missing_package_manager'
    | 'port_unavailable'
    | 'missing_directory';

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

export const PreviewService = Symbol('PreviewService');

export interface PreviewService {
    readonly onStateChange: Event<PreviewStatus>;
    readonly onLog: Event<PreviewLogEvent>;

    getStatus(): Promise<PreviewStatus>;
    startPreview(workspaceRootUri: string): Promise<void>;
    stopPreview(): Promise<void>;
    restartPreview(workspaceRootUri: string): Promise<void>;
}

// Phase 4: Dependency Doctor Service
export const DependencyDoctorServicePath = '/services/dependency-doctor';

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
    confidenceScore: number; // 0.0 to 1.0
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

export const DependencyDoctorService = Symbol('DependencyDoctorService');

export interface DependencyDoctorService {
    readonly onIssuesUpdated: Event<DetectedIssue[]>;

    analyzeLogs(input: AnalyzeLogsInput): Promise<DiagnosticReport>;
    listActiveIssues(workspaceRootUri: string): Promise<DetectedIssue[]>;
    applyFix(workspaceRootUri: string, issueId: string): Promise<FixResult>;
    dismissIssue(workspaceRootUri: string, issueId: string): Promise<void>;
}


// Alpha Phase: Forge Conductor
export const ForgeConductorServicePath = '/services/forge-conductor';

export type ProjectPhase =
  | 'idea'
  | 'validation'
  | 'business-blueprint'
  | 'app-blueprint'
  | 'project-generation'
  | 'live-preview'
  | 'mvp-build'
  | 'dependency-fix'
  | 'security-pass'
  | 'launch-prep'
  | 'deployment'
  | 'feedback'
  | 'iteration';

export type TaskOwner = 'human' | 'forge-conductor' | 'forge-scout' | 'codegen' | 'dependency-doctor' | 'project-generator' | 'live-preview' | 'forgeops';

export interface ProjectTask {
  id: string;
  title: string;
  phase: ProjectPhase;
  status: 'not_started' | 'in_progress' | 'blocked' | 'failed' | 'done';
  owner: TaskOwner;
  dependencies: string[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  completedAt?: number;
}

export interface ProjectDecision {
    id: string;
    title: string;
    description: string;
    madeBy: TaskOwner;
    timestamp: number;
}

export interface ProjectRisk {
    id: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigationPlan?: string;
    status: 'open' | 'mitigated' | 'accepted';
}

export interface HumanAction {
    id: string;
    description: string;
    reason: string;
    status: 'pending' | 'completed';
    createdAt: number;
}

export interface UserPreferences {
    preferredStack: string[];
    routingMode: string;
    approvalStyle: 'strict' | 'lenient';
    explanationDepth: 'quick' | 'standard' | 'deep';
}

export interface ProjectState {
    phase: ProjectPhase;
    health: 'healthy' | 'warning' | 'critical';
    lastCompletedTaskId?: string;
}

export interface ProjectStateUpdate {
    workspaceRootUri: string;
    phase?: ProjectPhase;
    health?: 'healthy' | 'warning' | 'critical';
    lastCompletedTaskId?: string;
}

export interface TaskEvent {
    workspaceRootUri: string;
    task: ProjectTask;
}

export interface RecommendedAction {
    id: string;
    title: string;
    description: string;
    delegationId?: string; // ID used by delegateAction to execute
    isHumanAction?: boolean;
}

export interface DelegationResult {
    success: boolean;
    message: string;
}

export const ForgeConductorService = Symbol('ForgeConductorService');

export interface ForgeConductorService {
    readonly onStateUpdated: Event<void>;

    getProjectState(workspaceRootUri: string): Promise<ProjectState>;
    updateProjectState(update: ProjectStateUpdate): Promise<ProjectState>;

    getTasks(workspaceRootUri: string): Promise<ProjectTask[]>;
    recordTaskEvent(event: TaskEvent): Promise<void>;

    getDecisions(workspaceRootUri: string): Promise<ProjectDecision[]>;
    recordDecision(workspaceRootUri: string, decision: ProjectDecision): Promise<void>;

    getRisks(workspaceRootUri: string): Promise<ProjectRisk[]>;
    recordRisk(workspaceRootUri: string, risk: ProjectRisk): Promise<void>;

    getHumanActions(workspaceRootUri: string): Promise<HumanAction[]>;
    addHumanAction(workspaceRootUri: string, action: HumanAction): Promise<void>;
    resolveHumanAction(workspaceRootUri: string, actionId: string): Promise<void>;

    getPreferences(workspaceRootUri: string): Promise<UserPreferences>;

    getNextRecommendedActions(workspaceRootUri: string): Promise<RecommendedAction[]>;
    delegateAction(workspaceRootUri: string, delegationId: string): Promise<DelegationResult>;
}
