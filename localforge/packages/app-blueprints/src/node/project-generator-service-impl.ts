import { injectable, inject } from '@theia/core/shared/inversify';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from '@theia/core';
import * as ejs from 'ejs';
import {
    ProjectGeneratorService,
    BlueprintAnalysis,
    ProjectGenerationPlan,
    GenerateProjectInput,
    ProjectGenerationResult,
    TemplateContext,
    ForgeConductorService
} from '../common/protocol';

@injectable()
export class ProjectGeneratorServiceImpl implements ProjectGeneratorService {

    @inject(ForgeConductorService)
    protected readonly conductorService!: ForgeConductorService;

    private get templatesDir() {
        return path.join(process.cwd(), 'localforge', 'templates');
    }

    public async analyzeBlueprint(workspaceRootUriStr: string): Promise<BlueprintAnalysis> {
        const rootUri = new URI(workspaceRootUriStr);
        const blueprintPath = path.join(rootUri.path.toString(), 'docs', 'app-blueprint.md');

        if (!fs.existsSync(blueprintPath)) {
            throw new Error('No app-blueprint.md found in /docs. Please run Forge Scout first.');
        }

        const rawContent = fs.readFileSync(blueprintPath, 'utf8');

        const extractList = (header: string): string[] => {
            const regex = new RegExp(`## ${header}\\n([\\s\\S]*?)(?:\\n## |$)`);
            const match = rawContent.match(regex);
            if (!match) return [];
            return match[1].split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.replace(/^-\s*/, '').trim());
        };

        const typeMatch = rawContent.match(/Type:\s*(.+)/);
        const stackMatch = rawContent.match(/Stack:\s*(.+)/);

        return {
            appType: typeMatch ? typeMatch[1].trim() : 'custom',
            recommendedStack: stackMatch ? stackMatch[1].split(',').map(s => s.trim()) : ['Next.js', 'React', 'Tailwind', 'TypeScript'],
            pages: extractList('Pages'),
            components: extractList('Core Components'),
            apiRoutes: extractList('API Routes'),
            databaseEntities: extractList('Database Schema'),
            rawContent
        };
    }

    private normalizeContext(analysis: BlueprintAnalysis): TemplateContext {
        const templateManifestPath = path.join(this.templatesDir, 'nextjs-starter', 'template.json');
        let deps = { "next": "latest", "react": "latest", "react-dom": "latest" };
        let devDeps = { "typescript": "latest", "tailwindcss": "latest" };

        if (fs.existsSync(templateManifestPath)) {
            const tpl = JSON.parse(fs.readFileSync(templateManifestPath, 'utf8'));
            deps = tpl.dependencies || deps;
            devDeps = tpl.devDependencies || devDeps;
        }

        const entities = analysis.databaseEntities.map(e => {
            const match = e.match(/(.*?)\s*\((.*?)\)/);
            if (!match) return { name: e.replace(/\W+/g, ''), fields: [{ name: 'id', type: 'String @id @default(cuid())' }] };

            const fields = match[2].split(',').map(f => {
                const fName = f.trim();
                let type = 'String';
                if (fName.toLowerCase() === 'id') type = 'String @id @default(cuid())';
                if (fName.toLowerCase().includes('date') || fName.toLowerCase().includes('at')) type = 'DateTime';
                if (fName.toLowerCase().includes('price') || fName.toLowerCase().includes('amount') || fName.toLowerCase().includes('mins')) type = 'Int';
                return { name: fName, type };
            });
            return { name: match[1].trim(), fields };
        });

        const apiRoutes = analysis.apiRoutes.map(a => {
            const match = a.match(/(?:GET|POST|PUT|DELETE)\s+(\S+)/i);
            const methodMatch = a.match(/^(GET|POST|PUT|DELETE)/i);
            return {
                path: match ? match[1].replace(/^\//, '') : `api/custom_${Date.now()}`,
                method: methodMatch ? methodMatch[1].toUpperCase() : 'GET'
            };
        });

        // Basic integration parsing
        const extractIntegrations = (rawContent: string) => {
            const match = rawContent.match(/## Integrations\n([\s\S]*?)(?:\n## |$)/);
            if (!match) return [];
            return match[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').replace(/\s*\(.*?\)/, '').trim());
        };

        return {
            appName: "generated-app",
            appType: analysis.appType,
            pages: analysis.pages,
            components: analysis.components.map(c => c.replace(/\W+/g, '')),
            apiRoutes,
            entities,
            integrations: extractIntegrations(analysis.rawContent),
            workflows: [], // Can parse if needed
            dependencies: deps,
            devDependencies: devDeps
        };
    }

    public async getGenerationPlan(input: GenerateProjectInput): Promise<ProjectGenerationPlan> {
        const targetDir = input.targetDir || 'apps/web';
        const files: { path: string, description: string }[] = [];
        const ctx = this.normalizeContext(input.analysis);

        files.push({ path: `${targetDir}/package.json`, description: 'Next.js project dependencies' });
        files.push({ path: `${targetDir}/tsconfig.json`, description: 'TypeScript configuration' });
        files.push({ path: `${targetDir}/next.config.js`, description: 'Next.js configuration' });
        files.push({ path: `${targetDir}/.env.example`, description: 'Environment variables template' });
        files.push({ path: `${targetDir}/README.md`, description: 'Project documentation' });
        files.push({ path: `${targetDir}/src/app/layout.tsx`, description: 'Root Layout' });
        files.push({ path: `${targetDir}/src/app/globals.css`, description: 'Global styles' });
        files.push({ path: `${targetDir}/prisma/schema.prisma`, description: 'Database schema' });

        for (const page of ctx.pages) {
            const route = page.split(' ')[0].replace(/^\//, '');
            const filePath = route ? `${targetDir}/src/app/${route}/page.tsx` : `${targetDir}/src/app/page.tsx`;
            files.push({ path: filePath, description: `Page template for ${page}` });
        }

        for (const comp of ctx.components) {
            files.push({ path: `${targetDir}/src/components/${comp}.tsx`, description: `UI Component: ${comp}` });
        }

        for (const api of ctx.apiRoutes) {
            files.push({ path: `${targetDir}/src/app/${api.path}/route.ts`, description: `API endpoint for ${api.method} /${api.path}` });
        }

        files.push({ path: `.localforge/generation-report.md`, description: 'Audit log of project generation' });

        return {
            templateId: 'nextjs-starter',
            targetDir,
            stack: input.analysis.recommendedStack,
            directoriesToCreate: [
                targetDir,
                `${targetDir}/src/app`,
                `${targetDir}/src/components`,
                `${targetDir}/src/lib`,
                `${targetDir}/src/data`,
                `${targetDir}/prisma`,
                '.localforge'
            ],
            filesToCreate: files
        };
    }

    public async generateProject(input: GenerateProjectInput): Promise<ProjectGenerationResult> {
        const rootUri = new URI(input.workspaceRootUri);
        const rootPath = rootUri.path.toString();

        const plan = await this.getGenerationPlan(input);
        const ctx = this.normalizeContext(input.analysis);
        const templateRoot = path.join(this.templatesDir, plan.templateId);

        let filesCreated = 0;

        try {
            if (!fs.existsSync(templateRoot)) {
                throw new Error(`Template directory not found: ${templateRoot}`);
            }

            for (const dir of plan.directoriesToCreate) {
                const fullDir = path.join(rootPath, dir);
                if (!fs.existsSync(fullDir)) {
                    fs.mkdirSync(fullDir, { recursive: true });
                }
            }

            const renderAndWrite = async (templateFile: string, destPath: string, localCtx: any = {}) => {
                const ejsPath = path.join(templateRoot, templateFile);
                if (fs.existsSync(ejsPath)) {
                    const mergedCtx = { ...ctx, ...localCtx };
                    const output = await ejs.renderFile(ejsPath, mergedCtx, { async: true });
                    const fullPath = path.join(rootPath, destPath);
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

                    if (fs.existsSync(fullPath)) {
                        const backupPath = fullPath + '.bak_' + Date.now();
                        fs.copyFileSync(fullPath, backupPath);
                    }

                    fs.writeFileSync(fullPath, output.trim(), 'utf8');
                    filesCreated++;
                } else {
                    console.warn(`Template file missing: ${ejsPath}`);
                }
            };

            await renderAndWrite('package.json.ejs', `${plan.targetDir}/package.json`);
            await renderAndWrite('tsconfig.json.ejs', `${plan.targetDir}/tsconfig.json`);
            await renderAndWrite('next.config.js.ejs', `${plan.targetDir}/next.config.js`);
            await renderAndWrite('.env.example.ejs', `${plan.targetDir}/.env.example`);
            await renderAndWrite('README.md.ejs', `${plan.targetDir}/README.md`);
            await renderAndWrite('src/app/layout.tsx.ejs', `${plan.targetDir}/src/app/layout.tsx`);
            await renderAndWrite('src/styles/globals.css.ejs', `${plan.targetDir}/src/app/globals.css`);
            await renderAndWrite('prisma/schema.prisma.ejs', `${plan.targetDir}/prisma/schema.prisma`);

            for (const page of ctx.pages) {
                const route = page.split(' ')[0].replace(/^\//, '');
                const filePath = route ? `${plan.targetDir}/src/app/${route}/page.tsx` : `${plan.targetDir}/src/app/page.tsx`;
                const componentName = route ? route.replace(/\W+/g, '_').toUpperCase() + '_PAGE' : 'Home';
                await renderAndWrite('src/app/page.tsx.ejs', filePath, { pagePath: page, componentName });
            }

            for (const comp of ctx.components) {
                await renderAndWrite('src/components/GeneratedComponent.tsx.ejs', `${plan.targetDir}/src/components/${comp}.tsx`, { componentName: comp });
            }

            for (const api of ctx.apiRoutes) {
                await renderAndWrite('src/app/api-route.ts.ejs', `${plan.targetDir}/src/app/${api.path}/route.ts`, { apiPath: api.path, method: api.method });
            }

            // Write generation report explicitly
            const reportPath = path.join(rootPath, '.localforge/generation-report.md');
            fs.writeFileSync(reportPath, `
# LocalForge Generation Report
Date: ${new Date().toISOString()}
Target: ${plan.targetDir}
Template: ${plan.templateId}

## Analysis
Found ${ctx.pages.length} pages, ${ctx.components.length} components, ${ctx.apiRoutes.length} APIs, ${ctx.entities.length} db entities.

## Results
Successfully generated ${filesCreated} files based on the App Blueprint using EJS templates.
            `.trim(), 'utf8');

            await this.conductorService.updateProjectState({ workspaceRootUri: input.workspaceRootUri, phase: 'project-generation' });

            return {
                success: true,
                generatedFilesCount: filesCreated,
                targetDir: plan.targetDir
            };

        } catch (e) {
            return {
                success: false,
                generatedFilesCount: filesCreated,
                targetDir: plan.targetDir,
                error: String(e)
            };
        }
    }
}
