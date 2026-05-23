import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { URI } from '@theia/core';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import fetch from 'cross-fetch';
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

        // Phase 6: Proxy Customer Stub / Playwright E2E Error interception
        const e2eMatch = line.match(/\[E2E\] Test failed: (.*)/);
        if (e2eMatch && !newIssue) {
            newIssue = {
                id: `err_e2e_${Date.now()}`,
                severity: 'critical',
                rawLog: line,
                issueSummary: `Proxy Customer E2E Failure`,
                explanation: `The background Proxy Customer encountered an error simulating a user flow: ${e2eMatch[1]}`,
                likelyCause: `A UI component is misconfigured or an API endpoint is failing.`,
                suggestedFix: `Review the proposed Codegen patch to fix the broken component.`,
                confidenceScore: 0.98,
                action: {
                    type: 'human_action_required',
                    payload: {},
                    description: `Review E2E fix patch`,
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

        // Run OSV Supply Chain Scan
        await this.runOsvScan(input.workspaceRootUri);

        const issues = this.activeIssues.get('default') || [];
        return {
            issues,
            timestamp: Date.now()
        };
    }

    private async runOsvScan(workspaceRootUriStr: string) {
        const rootUri = new URI(workspaceRootUriStr);
        const packageJsonPath = path.join(rootUri.path.toString(), 'apps', 'web', 'package.json');

        if (!fs.existsSync(packageJsonPath)) return;

        try {
            const pkgData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = { ...pkgData.dependencies, ...pkgData.devDependencies };

            const queries = Object.keys(deps).map(pkgName => {
                let version = deps[pkgName];
                version = version.replace(/^[\^~]/, ''); // Strip semver prefix
                return {
                    package: { name: pkgName, ecosystem: 'npm' },
                    version: version
                };
            });

            // OSV Batch Query API
            const response = await fetch('https://api.osv.dev/v1/querybatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queries })
            });

            if (response.ok) {
                const data = await response.json();
                const existing = this.activeIssues.get('default') || [];

                data.results?.forEach((result: any, index: number) => {
                    if (result.vulns && result.vulns.length > 0) {
                        const pkgName = queries[index].package.name;
                        const vuln = result.vulns[0];
                        const issueId = `err_osv_${pkgName}_${vuln.id}`;

                        if (!existing.find(e => e.id === issueId)) {
                            existing.push({
                                id: issueId,
                                severity: 'critical',
                                rawLog: `OSV Scan detected vulnerability in ${pkgName}`,
                                issueSummary: `Vulnerable Dependency: ${pkgName} (${vuln.id})`,
                                explanation: vuln.summary || `A vulnerability was found in the ${pkgName} package.`,
                                likelyCause: `The version of ${pkgName} in your package.json is known to be vulnerable.`,
                                suggestedFix: `Upgrade ${pkgName} to a secure version based on the OSV advisory.`,
                                confidenceScore: 1.0,
                                action: {
                                    type: 'human_action_required',
                                    description: `Upgrade ${pkgName} to fix ${vuln.id}`,
                                    isSafeAutoFix: false
                                }
                            });
                        }
                    }
                });

                this.activeIssues.set('default', existing);
                this.onIssuesUpdatedEmitter.fire(existing);
            }
        } catch (e) {
            console.error('OSV Scan failed:', e);
        }
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
