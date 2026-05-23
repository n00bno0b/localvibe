import { injectable, inject } from '@theia/core/shared/inversify';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from '@theia/core';
import { LocalBrainService, LocalBrainChatService } from '../../../local-brain/src/common/protocol';
import { ForgeConductorService } from '../common/protocol';
import {
    ForgeScoutService,
    DiscoveryInput,
    DiscoverySession,
    ProductOption,
    ClarifyingAnswer,
    BusinessBlueprint,
    AppBlueprint,
    SavedBlueprintResult
} from '../common/protocol';

@injectable()
export class ForgeScoutServiceImpl implements ForgeScoutService {

    // In a real environment, we'd inject LocalBrainChatService to attempt real generation
    // if the status is ready. For now, we optionally inject it if available, else null.
    // Theia dependency injection requires @optional if it might not be bound, but we know it is bound.
    @inject(LocalBrainChatService)
    protected readonly localBrainChatService!: LocalBrainChatService;

    @inject(LocalBrainService)
    protected readonly localBrainService!: LocalBrainService;

    @inject(ForgeConductorService)
    protected readonly conductorService!: ForgeConductorService;

    private sessions = new Map<string, DiscoverySession>();

    public async createDiscoverySession(input: DiscoveryInput): Promise<DiscoverySession> {
        const sessionId = `ds_${Date.now()}`;
        const session: DiscoverySession = {
            sessionId,
            input
        };
        this.sessions.set(sessionId, session);
        return session;
    }

    public async generateProductOptions(sessionId: string): Promise<ProductOption[]> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        // Check if real Local Brain is running. If so, we COULD use it.
        // For Phase 3A, we simulate the structured JSON response as it requires reliable function calling.
        // We will default to a high-quality mock based on the user's idea.
        const ideaLower = session.input.idea.toLowerCase();

        let targetCustomer = 'General Users';
        if (ideaLower.includes('car') || ideaLower.includes('detailer')) {
            targetCustomer = 'Mobile Car Detailers';
        }

        const options: ProductOption[] = [
            {
                id: 'opt_1',
                title: 'Lean Booking Tool',
                description: `A focused MVP allowing ${targetCustomer} to accept online bookings and payments with minimal setup.`,
                targetCustomer,
                difficulty: 'low',
                validationRisk: 'low',
                buildComplexity: 'mvp',
                recommended: true
            },
            {
                id: 'opt_2',
                title: 'Full CRM Platform',
                description: `A comprehensive platform to manage fleets, recurring customers, inventory, and staff dispatching.`,
                targetCustomer: `Enterprise ${targetCustomer}`,
                difficulty: 'high',
                validationRisk: 'high',
                buildComplexity: 'platform',
                recommended: false
            },
            {
                id: 'opt_3',
                title: 'Customer Lead Generator',
                description: `A simple landing page and lead capture system to validate demand before building the actual scheduling logic.`,
                targetCustomer,
                difficulty: 'low',
                validationRisk: 'low',
                buildComplexity: 'prototype',
                recommended: false
            }
        ];

        session.productOptions = options;
        return options;
    }

    public async selectProductOption(sessionId: string, optionId: string): Promise<DiscoverySession> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        session.selectedOptionId = optionId;
        return session;
    }

    public async answerClarifyingQuestion(sessionId: string, answer: ClarifyingAnswer): Promise<DiscoverySession> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        return session;
    }

    public async generateBusinessBlueprint(sessionId: string): Promise<BusinessBlueprint> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const option = session.productOptions?.find(o => o.id === session.selectedOptionId);

        const bp: BusinessBlueprint = {
            productName: 'DetailSync (Placeholder)',
            targetCustomer: option?.targetCustomer || 'Unknown Customer',
            problemStatement: `Scheduling and payments take up too much time for ${option?.targetCustomer || 'these users'}.`,
            valueProposition: 'Automate your booking flow and get paid instantly without lifting a finger.',
            mvpScope: [
                'Public booking page',
                'Calendar sync integration',
                'Stripe payment processing',
                'Admin dashboard for upcoming jobs'
            ],
            businessModelOptions: [
                'SaaS: $29/mo subscription',
                'Transaction fee: 2% + 30c per booking',
                'Freemium: Free up to 10 bookings/mo'
            ],
            validationPlan: [
                'Set up a waitlist landing page',
                'Post in 3 relevant Facebook/Reddit groups',
                'Offer 5 local businesses a free 3-month trial to test it'
            ],
            launchChecklist: [
                'Finalize branding and domain',
                'Test Stripe webhooks in test mode',
                'Write onboarding email sequence'
            ],
            risks: [
                'Competitors like Square already exist (differentiation needed)',
                'High churn if setup is too complex'
            ]
        };

        session.businessBlueprint = bp;
        return bp;
    }

    public async generateAppBlueprint(sessionId: string): Promise<AppBlueprint> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');

        const ab: AppBlueprint = {
            appType: 'saas',
            pages: [
                '/ (Landing Page)',
                '/book/[id] (Public Booking)',
                '/dashboard (Admin Home)',
                '/dashboard/jobs (Job List)',
                '/dashboard/settings (Config)'
            ],
            components: [
                'BookingCalendar',
                'PaymentForm',
                'JobCard',
                'SidebarNav'
            ],
            databaseEntities: [
                'User (id, email, stripeAccountId)',
                'ServiceType (id, userId, name, price, durationMins)',
                'Booking (id, userId, serviceId, customerName, date, status)'
            ],
            apiRoutes: [
                'POST /api/bookings',
                'POST /api/stripe/webhook',
                'GET /api/jobs'
            ],
            integrations: [
                'Stripe (Payments)',
                'Resend (Transactional Emails)'
            ],
            workflows: [
                'Customer Books -> Create Booking -> Send Confirmation Email',
                'Job Completed -> Request Review Email'
            ],
            recommendedStack: [
                'Next.js (App Router)',
                'React',
                'Tailwind CSS',
                'Prisma / PostgreSQL',
                'NextAuth.js'
            ]
        };

        session.appBlueprint = ab;
        return ab;
    }

    public async saveBlueprintToWorkspace(sessionId: string, workspaceRootUriStr: string): Promise<SavedBlueprintResult> {
        const session = this.sessions.get(sessionId);
        if (!session || !session.businessBlueprint || !session.appBlueprint) {
            return { success: false, filesSaved: [], error: 'Session or blueprints missing' };
        }

        try {
            const rootUri = new URI(workspaceRootUriStr);
            const rootPath = rootUri.path.toString();
            const docsPath = path.join(rootPath, 'docs');

            if (!fs.existsSync(docsPath)) {
                fs.mkdirSync(docsPath, { recursive: true });
            }

            const bb = session.businessBlueprint;
            const ab = session.appBlueprint;

            const savedFiles: string[] = [];

            const writeMd = (filename: string, content: string) => {
                const fp = path.join(docsPath, filename);
                fs.writeFileSync(fp, content, 'utf8');
                savedFiles.push(`/docs/${filename}`);
            };

            writeMd('product-brief.md', `# Product Brief: ${bb.productName}\n\n**Idea:**\n${session.input.idea}\n\n**Goal:**\n${session.input.goal}`);
            writeMd('business-blueprint.md', `# Business Blueprint\n\n## Value Prop\n${bb.valueProposition}\n\n## Problem\n${bb.problemStatement}\n\n## Target Customer\n${bb.targetCustomer}\n\n## Business Models\n${bb.businessModelOptions.map(m => `- ${m}`).join('\n')}`);
            writeMd('mvp-scope.md', `# MVP Scope\n\n${bb.mvpScope.map(m => `- ${m}`).join('\n')}`);
            writeMd('validation-plan.md', `# Validation Plan\n\n${bb.validationPlan.map(m => `- ${m}`).join('\n')}\n\n## Risks\n${bb.risks.map(r => `- ${r}`).join('\n')}`);

            const abContent = `# App Technical Blueprint

## Architecture
Type: ${ab.appType}
Stack: ${ab.recommendedStack.join(', ')}

## Database Schema
${ab.databaseEntities.map(d => `- ${d}`).join('\n')}

## Pages
${ab.pages.map(p => `- ${p}`).join('\n')}

## Core Components
${ab.components.map(c => `- ${c}`).join('\n')}

## API Routes
${ab.apiRoutes.map(a => `- ${a}`).join('\n')}

## Integrations
${ab.integrations.map(i => `- ${i}`).join('\n')}

## Workflows
${ab.workflows.map(w => `- ${w}`).join('\n')}
`;
            writeMd('app-blueprint.md', abContent);

            await this.conductorService.updateProjectState({ workspaceRootUri: workspaceRootUriStr, phase: 'app-blueprint' });
            return { success: true, filesSaved: savedFiles };

        } catch (e) {
            return { success: false, filesSaved: [], error: String(e) };
        }
    }
}
