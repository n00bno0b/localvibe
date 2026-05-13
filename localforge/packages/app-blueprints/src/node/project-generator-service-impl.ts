import { injectable } from '@theia/core/shared/inversify';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from '@theia/core';
import {
    ProjectGeneratorService,
    BlueprintAnalysis,
    ProjectGenerationPlan,
    GenerateProjectInput,
    ProjectGenerationResult
} from '../common/protocol';

@injectable()
export class ProjectGeneratorServiceImpl implements ProjectGeneratorService {

    public async analyzeBlueprint(workspaceRootUriStr: string): Promise<BlueprintAnalysis> {
        const rootUri = new URI(workspaceRootUriStr);
        const blueprintPath = path.join(rootUri.path.toString(), 'docs', 'app-blueprint.md');

        if (!fs.existsSync(blueprintPath)) {
            throw new Error('No app-blueprint.md found in /docs. Please run Forge Scout first.');
        }

        const rawContent = fs.readFileSync(blueprintPath, 'utf8');

        // Simple markdown parsing based on the predictable output from Phase 3A
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

    public async getGenerationPlan(input: GenerateProjectInput): Promise<ProjectGenerationPlan> {
        const targetDir = input.targetDir || 'apps/web';
        const files: { path: string, description: string }[] = [];

        files.push({ path: `${targetDir}/package.json`, description: 'Next.js project dependencies' });
        files.push({ path: `${targetDir}/tsconfig.json`, description: 'TypeScript configuration' });
        files.push({ path: `${targetDir}/next.config.js`, description: 'Next.js configuration' });
        files.push({ path: `${targetDir}/.env.example`, description: 'Environment variables template' });
        files.push({ path: `${targetDir}/README.md`, description: 'Project documentation' });

        for (const page of input.analysis.pages) {
            // Strip routing logic, e.g. "/dashboard (Admin Home)" -> "dashboard"
            const route = page.split(' ')[0].replace(/^\//, '');
            const filePath = route ? `${targetDir}/src/app/${route}/page.tsx` : `${targetDir}/src/app/page.tsx`;
            files.push({ path: filePath, description: `Page template for ${page}` });
        }

        for (const comp of input.analysis.components) {
            files.push({ path: `${targetDir}/src/components/${comp}.tsx`, description: `UI Component: ${comp}` });
        }

        for (const api of input.analysis.apiRoutes) {
            // e.g. "POST /api/bookings" -> "api/bookings"
            const routeMatch = api.match(/(?:GET|POST|PUT|DELETE)\s+(\S+)/i);
            const routePath = routeMatch ? routeMatch[1].replace(/^\//, '') : `api/custom_${Date.now()}`;
            files.push({ path: `${targetDir}/src/app/${routePath}/route.ts`, description: `API endpoint for ${api}` });
        }

        files.push({ path: `.localforge/generation-report.md`, description: 'Audit log of project generation' });

        return {
            targetDir,
            stack: input.analysis.recommendedStack,
            directoriesToCreate: [
                targetDir,
                `${targetDir}/src/app`,
                `${targetDir}/src/components`,
                `${targetDir}/src/lib`,
                `${targetDir}/src/data`,
                '.localforge'
            ],
            filesToCreate: files
        };
    }

    public async generateProject(input: GenerateProjectInput): Promise<ProjectGenerationResult> {
        const rootUri = new URI(input.workspaceRootUri);
        const rootPath = rootUri.path.toString();

        const plan = await this.getGenerationPlan(input);

        let filesCreated = 0;

        try {
            // Create directories
            for (const dir of plan.directoriesToCreate) {
                const fullDir = path.join(rootPath, dir);
                if (!fs.existsSync(fullDir)) {
                    fs.mkdirSync(fullDir, { recursive: true });
                }
            }

            const write = (relPath: string, content: string) => {
                const fullPath = path.join(rootPath, relPath);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, content.trim(), 'utf8');
                filesCreated++;
            };

            // Write base config files
            write(`${plan.targetDir}/package.json`, JSON.stringify({
                name: "generated-app",
                version: "0.1.0",
                private: true,
                scripts: {
                    "dev": "next dev",
                    "build": "next build",
                    "start": "next start",
                    "lint": "next lint"
                },
                dependencies: {
                    "next": "latest",
                    "react": "latest",
                    "react-dom": "latest"
                },
                devDependencies: {
                    "@types/node": "latest",
                    "@types/react": "latest",
                    "@types/react-dom": "latest",
                    "typescript": "latest",
                    "tailwindcss": "latest",
                    "postcss": "latest"
                }
            }, null, 2));

            write(`${plan.targetDir}/tsconfig.json`, JSON.stringify({
                "compilerOptions": {
                    "target": "es5",
                    "lib": ["dom", "dom.iterable", "esnext"],
                    "allowJs": true,
                    "skipLibCheck": true,
                    "strict": true,
                    "forceConsistentCasingInFileNames": true,
                    "noEmit": true,
                    "esModuleInterop": true,
                    "module": "esnext",
                    "moduleResolution": "node",
                    "resolveJsonModule": true,
                    "isolatedModules": true,
                    "jsx": "preserve",
                    "incremental": true,
                    "plugins": [{ "name": "next" }],
                    "paths": { "@/*": ["./src/*"] }
                },
                "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
                "exclude": ["node_modules"]
            }, null, 2));

            write(`${plan.targetDir}/next.config.js`, `
/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig
            `);

            write(`${plan.targetDir}/.env.example`, `
# Environment Variables
DATABASE_URL="file:./dev.db"
            `);

            write(`${plan.targetDir}/README.md`, `
# Generated App
This project was scaffolded by LocalForge Phase 3B.

## Next Steps
1. Run \`pnpm install\` or \`npm install\`
2. Run \`npm run dev\`
            `);

            // Generate Pages
            for (const page of input.analysis.pages) {
                const route = page.split(' ')[0].replace(/^\//, '');
                const filePath = route ? `${plan.targetDir}/src/app/${route}/page.tsx` : `${plan.targetDir}/src/app/page.tsx`;
                const componentName = route ? route.replace(/\\W+/g, '_').toUpperCase() + '_PAGE' : 'Home';
                write(filePath, `
export default function ${componentName}() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">${page}</h1>
      <p className="mt-4">Placeholder generated by LocalForge Blueprint.</p>
    </main>
  );
}
                `);
            }

            // Generate Components
            for (const comp of input.analysis.components) {
                const safeName = comp.replace(/\\W+/g, '');
                write(`${plan.targetDir}/src/components/${safeName}.tsx`, `
export function ${safeName}() {
  return (
    <div className="border p-4 rounded bg-gray-50 dark:bg-gray-800">
      <h3 className="font-semibold">${comp}</h3>
      <p className="text-sm">Component Placeholder</p>
    </div>
  );
}
                `);
            }

            // Generate APIs
            for (const api of input.analysis.apiRoutes) {
                const routeMatch = api.match(/(?:GET|POST|PUT|DELETE)\s+(\S+)/i);
                const methodMatch = api.match(/^(GET|POST|PUT|DELETE)/i);
                const routePath = routeMatch ? routeMatch[1].replace(/^\//, '') : `api/custom_${Date.now()}`;
                const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

                write(`${plan.targetDir}/src/app/${routePath}/route.ts`, `
import { NextResponse } from 'next/server';

export async function ${method}(request: Request) {
  return NextResponse.json({ message: 'Placeholder API for ${api}' });
}
                `);
            }

            // Write generation report
            write('.localforge/generation-report.md', `
# LocalForge Generation Report
Date: ${new Date().toISOString()}
Target: ${plan.targetDir}

## Analysis
Found ${input.analysis.pages.length} pages, ${input.analysis.components.length} components, ${input.analysis.apiRoutes.length} APIs.

## Results
Successfully generated ${filesCreated} files based on the App Blueprint.

## Project State Update
Current phase: mvp-build
Last completed task: Generated Next.js project scaffold
Next recommended task: Install dependencies and run live preview
            `);

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
