import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { URI } from '@theia/core';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectIndexerService, IndexStatus, SearchResult } from '../common/protocol';

interface DocumentChunk {
    filePath: string;
    content: string;
    tokens: Set<string>;
}

@injectable()
export class ProjectIndexerServiceImpl implements ProjectIndexerService {

    private readonly onIndexUpdatedEmitter = new Emitter<IndexStatus>();
    public readonly onIndexUpdated: Event<IndexStatus> = this.onIndexUpdatedEmitter.event;

    private state: IndexStatus = { state: 'idle', filesIndexed: 0 };
    private index: Map<string, DocumentChunk[]> = new Map(); // workspaceRoot -> chunks

    @postConstruct()
    protected init() {
        // Initialization logic if needed
    }

    public async getIndexStatus(workspaceRootUriStr: string): Promise<IndexStatus> {
        return this.state;
    }

    private updateState(partial: Partial<IndexStatus>) {
        this.state = { ...this.state, ...partial };
        this.onIndexUpdatedEmitter.fire(this.state);
    }

    private tokenize(text: string): Set<string> {
        // Simple tokenization: lowercase, split by non-alphanumeric, remove empty
        const words = text.toLowerCase().split(/[^a-z0-9]+/);
        return new Set(words.filter(w => w.length > 2));
    }

    private walkDir(dir: string, fileList: string[] = []): string[] {
        if (!fs.existsSync(dir)) return fileList;

        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                // Ignore node_modules, .git, .next, dist
                if (!['node_modules', '.git', '.next', 'dist', 'build', '.localforge'].includes(file)) {
                    this.walkDir(fullPath, fileList);
                }
            } else {
                // Only index code/text files
                const ext = path.extname(file);
                if (['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.prisma'].includes(ext)) {
                    fileList.push(fullPath);
                }
            }
        }
        return fileList;
    }

    public async indexWorkspace(workspaceRootUriStr: string): Promise<IndexStatus> {
        this.updateState({ state: 'indexing' });

        try {
            const rootUri = new URI(workspaceRootUriStr);
            const rootPath = rootUri.path.toString();

            const chunks: DocumentChunk[] = [];
            let filesIndexed = 0;

            const allFiles = this.walkDir(rootPath);

            for (const file of allFiles) {
                try {
                    const content = fs.readFileSync(file, 'utf8');

                    // Simple chunking strategy for MVP: file-level or split by double newline
                    // We'll keep it file-level for small files, and chunk by empty lines for large ones.
                    const fileChunks = content.split('\n\n');

                    for (const chunk of fileChunks) {
                        if (chunk.trim().length > 10) {
                            chunks.push({
                                filePath: path.relative(rootPath, file),
                                content: chunk.trim(),
                                tokens: this.tokenize(chunk)
                            });
                        }
                    }
                    filesIndexed++;
                } catch (e) {
                    console.warn(`Failed to read file for indexing: ${file}`);
                }
            }

            this.index.set(workspaceRootUriStr, chunks);
            this.updateState({ state: 'ready', filesIndexed, lastUpdated: Date.now() });

        } catch (e) {
            this.updateState({ state: 'error', error: String(e) });
        }

        return this.state;
    }

    public async search(workspaceRootUriStr: string, query: string, limit: number = 5): Promise<SearchResult[]> {
        const chunks = this.index.get(workspaceRootUriStr) || [];
        if (chunks.length === 0) {
            return []; // Not indexed yet
        }

        const queryTokens = Array.from(this.tokenize(query));
        if (queryTokens.length === 0) return [];

        // Basic TF/IDF inspired scoring
        const results: { chunk: DocumentChunk, score: number }[] = [];

        for (const chunk of chunks) {
            let score = 0;
            for (const qt of queryTokens) {
                if (chunk.tokens.has(qt)) {
                    score += 1;
                }
            }
            // Add slight bonus for exact phrase matches
            if (chunk.content.toLowerCase().includes(query.toLowerCase())) {
                score += 5;
            }

            if (score > 0) {
                results.push({ chunk, score });
            }
        }

        // Sort descending by score
        results.sort((a, b) => b.score - a.score);

        // Map to SearchResult and deduplicate by file path to get the best chunk per file
        const topResults: SearchResult[] = [];
        const seenPaths = new Set<string>();

        for (const res of results) {
            if (!seenPaths.has(res.chunk.filePath)) {
                seenPaths.add(res.chunk.filePath);
                topResults.push({
                    filePath: res.chunk.filePath,
                    score: res.score,
                    snippet: res.chunk.content.substring(0, 200) + '...'
                });

                if (topResults.length >= limit) break;
            }
        }

        return topResults;
    }
}
