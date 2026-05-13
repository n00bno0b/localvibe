import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { URI } from '@theia/core';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
    DependencyDoctorService,
    PreviewService,
    AnalyzeLogsInput,
    DiagnosticReport,
    DetectedIssue,
    FixResult
} from '../common/protocol';

@injectable()
export class DependencyDoctorServiceImpl implements DependencyDoctorService {

    private readonly onIssuesUpdatedEmitter = new Emitter<DetectedIssue[]>();
    public readonly onIssuesUpdated: Event<DetectedIssue[]> = this.onIssuesUpdatedEmitter.event;

    private activeIssues = new Map<string, DetectedIssue[]>();

    @inject(PreviewService)
    protected readonly previewService!: PreviewService;

    @postConstruct()
    protected init() {
        this.previewService.onLog(async log => {
            if (log.type === 'stderr' || log.type === 'stdout') {
                await this.processLogLine(log.message);
            }
        });
    }

    private async processLogLine(line: string) {
        const defaultWorkspacePath = 'default';
        let newIssue: DetectedIssue | undefined;

        // Rule 1: Missing Module
        const moduleMatch = line.match(/Module not found: Can't resolve '([@a-zA-Z0-9_\-\.]+)'/);
        if (moduleMatch) {
            const pkg = moduleMatch[1];
            newIssue = {
                id: `err_mod_${Date.now()}`,
                severity: 'critical',
                rawLog: line,
                issueSummary: `Missing dependency: ${pkg}`,
                explanation: `Your app is trying to use a package that has not been installed yet.`,
                likelyCause: `The app imports '${pkg}', but it is not installed in your package.json.`,
                suggestedFix: `Install ${pkg} using your package manager.`,
                confidenceScore: 0.95,
                action: {
                    type: 'install_package',
                    payload: { packageName: pkg },
                    description: `Install ${pkg}`,
                    isSafeAutoFix: true
                }
            };
        }

        // Rule 2: Missing Env Var
        const envMatch = line.match(/Missing environment variable:\s*([a-zA-Z0-9_]+)/);
        if (envMatch && !newIssue) {
            const envKey = envMatch[1];
            newIssue = {
                id: `err_env_${Date.now()}`,
                severity: 'critical',
                rawLog: line,
                issueSummary: `Missing environment variable: ${envKey}`,
                explanation: `Your app needs a secret configuration key to connect to an external service.`,
                likelyCause: `The generated app includes integration placeholders, but your local .env file does not have '${envKey}' yet.`,
                suggestedFix: `Add ${envKey} to .env.local.`,
                confidenceScore: 0.90,
                action: {
                    type: 'human_action_required',
                    payload: { envKey },
                    description: `Mark as human required`,
                    isSafeAutoFix: false
                }
            };
        }

        // Fallback: Local Brain interpretation stub
        if (!newIssue && (line.toLowerCase().includes('error:') || line.toLowerCase().includes('exception'))) {
            const existing = this.activeIssues.get(defaultWorkspacePath) || [];
            if (!existing.find(e => e.rawLog === line)) {
                newIssue = {
                    id: `err_unknown_${Date.now()}`,
                    severity: 'warning',
                    rawLog: line,
                    issueSummary: `Unknown Error Detected`,
                    explanation: `An unrecognized error occurred during preview.`,
                    likelyCause: `Unknown. Pending Local Brain analysis.`,
                    suggestedFix: `Ask Local Brain to analyze this log (Coming Soon).`,
                    confidenceScore: 0.2,
                    action: {
                        type: 'unknown',
                        description: `Analyze with Local Brain (Stub)`,
                        isSafeAutoFix: false
                    }
                };
            }
        }

        if (newIssue) {
            const existing = this.activeIssues.get(defaultWorkspacePath) || [];
            if (!existing.find(e => e.issueSummary === newIssue!.issueSummary)) {
                existing.push(newIssue);
                this.activeIssues.set(defaultWorkspacePath, existing);
                this.onIssuesUpdatedEmitter.fire(existing);
            }
        }
    }

    public async analyzeLogs(input: AnalyzeLogsInput): Promise<DiagnosticReport> {
        for (const log of input.logs) {
            await this.processLogLine(log.message);
        }
        const issues = this.activeIssues.get('default') || [];
        return {
            issues,
            timestamp: Date.now()
        };
    }

    public async listActiveIssues(workspaceRootUriStr: string): Promise<DetectedIssue[]> {
        return this.activeIssues.get('default') || [];
    }

    public async applyFix(workspaceRootUriStr: string, issueId: string): Promise<FixResult> {
        const issues = this.activeIssues.get('default') || [];
        const issue = issues.find(i => i.id === issueId);

        if (!issue) {
            return { success: false, issueId, message: 'Issue not found' };
        }

        const rootUri = new URI(workspaceRootUriStr);
        const appDir = path.join(rootUri.path.toString(), 'apps', 'web');

        try {
            if (issue.action.type === 'install_package') {
                const pkg = issue.action.payload.packageName;

                if (!/^[a-zA-Z0-9_\-\.\@]+$/.test(pkg)) {
                    return { success: false, issueId, message: 'Fix failed', error: 'Invalid package name format.' };
                }

                const pkgManager = fs.existsSync(path.join(appDir, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';

                await new Promise<void>((resolve, reject) => {
                    const proc = spawn(pkgManager, ['install', pkg], { cwd: appDir, shell: false });
                    proc.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`${pkgManager} exit code ${code}`));
                    });
                    proc.on('error', (err) => {
                        reject(err);
                    });
                });

                this.activeIssues.set('default', issues.filter(i => i.id !== issueId));
                this.onIssuesUpdatedEmitter.fire(this.activeIssues.get('default')!);

                return { success: true, issueId, message: `Successfully installed ${pkg}` };
            }

            if (issue.action.type === 'human_action_required') {
                this.activeIssues.set('default', issues.filter(i => i.id !== issueId));
                this.onIssuesUpdatedEmitter.fire(this.activeIssues.get('default')!);
                return { success: true, issueId, message: 'Acknowledged human requirement.' };
            }

            return { success: false, issueId, message: 'Unknown fix action type.' };

        } catch (e) {
            return { success: false, issueId, message: 'Fix failed', error: String(e) };
        }
    }

    public async dismissIssue(workspaceRootUriStr: string, issueId: string): Promise<void> {
        const issues = this.activeIssues.get('default') || [];
        this.activeIssues.set('default', issues.filter(i => i.id !== issueId));
        this.onIssuesUpdatedEmitter.fire(this.activeIssues.get('default')!);
    }
}
