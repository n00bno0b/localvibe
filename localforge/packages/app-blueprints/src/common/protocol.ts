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
