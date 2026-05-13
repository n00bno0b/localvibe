import * as fs from 'fs';
import * as path from 'path';
import { GeneratedPatch } from '../../../../local-brain/src/common/protocol';

export class CodegenPromptBuilder {

    public static buildSystemPrompt(workspacePath: string, appPath: string, contextFiles: string[]): string {
        let systemPrompt = `You are LocalForge AI, an expert software engineer assistant.
Your task is to propose codebase changes strictly matching the user's requested intent.

You MUST respond ONLY with a valid JSON object matching this schema. Do NOT include conversational text outside the JSON block. Do NOT use markdown formatting outside the \`\`\`json block.

SCHEMA:
{
  "summary": "Short description of the patch",
  "files": [
    {
      "path": "apps/web/src/components/Example.tsx",
      "action": "create" | "modify" | "delete",
      "before": "exact string to replace (if modify)",
      "after": "full file content (if create) or replacement string (if modify)"
    }
  ],
  "commands": [
    {
      "command": "pnpm install some-package",
      "reason": "Why this command is needed",
      "requiresApproval": true
    }
  ],
  "risks": ["Risk 1", "Risk 2"]
}

Guidelines:
- Prefer "create" or "modify" over "delete".
- When using "modify", provide enough lines in "before" to uniquely match the code being replaced.
- Paths MUST be relative to the workspace root.
- All code must adhere to modern Next.js (App Router), React, Tailwind, and TypeScript standards.

=== CURRENT PROJECT CONTEXT ===
`;

        for (const file of contextFiles) {
            const absolutePath = path.join(workspacePath, file);
            if (fs.existsSync(absolutePath)) {
                try {
                    const content = fs.readFileSync(absolutePath, 'utf8');
                    systemPrompt += `\n--- File: ${file} ---\n${content}\n------------------------\n`;
                } catch (e) {
                    // Skip unreadable files gracefully
                }
            }
        }

        return systemPrompt;
    }

    public static parseJsonPatch(rawResponse: string): GeneratedPatch {
        try {
            let jsonString = rawResponse.trim();

            // Extract from markdown block if present
            const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (match && match[1]) {
                jsonString = match[1].trim();
            }

            const parsed = JSON.parse(jsonString);

            // Basic schema validation
            if (!parsed.summary || !Array.isArray(parsed.files)) {
                throw new Error('Invalid patch schema: missing summary or files array');
            }

            for (const file of parsed.files) {
                if (!file.path || !['create', 'modify', 'delete'].includes(file.action)) {
                    throw new Error(`Invalid file action definition for path: ${file.path}`);
                }
            }

            return {
                id: `patch_${Date.now()}`,
                summary: parsed.summary,
                files: parsed.files,
                commands: parsed.commands || [],
                risks: parsed.risks || []
            };

        } catch (error) {
            throw new Error(`Failed to parse AI response into patch: ${error}`);
        }
    }
}
