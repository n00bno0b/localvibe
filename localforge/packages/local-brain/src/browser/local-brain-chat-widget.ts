import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget } from '@theia/core/lib/browser';
import { LocalBrainService, LocalBrainChatService, LocalBrainChatMessage, AICodegenService } from '../common/protocol';

export const LocalBrainChatWidgetOptions = {
    id: 'local-brain-chat-widget',
    label: 'Local Brain Chat'
};

@injectable()
export class LocalBrainChatWidget extends BaseWidget {

    @inject(LocalBrainService)
    protected readonly localBrainService!: LocalBrainService;

    @inject(LocalBrainChatService)
    protected readonly chatService!: LocalBrainChatService;

    @inject(AICodegenService)
    protected readonly codegenService!: AICodegenService;

    private container: HTMLDivElement;
    private historyContainer: HTMLDivElement;
    private inputArea: HTMLTextAreaElement;
    private sendButton: HTMLButtonElement;
    private stopButton: HTMLButtonElement;
    private statusDiv: HTMLDivElement;

    private messages: LocalBrainChatMessage[] = [];
    private currentSessionId: string | null = null;
    private isGenerating = false;
    private proposeModeToggle!: HTMLInputElement;

    constructor() {
        super();
        this.id = LocalBrainChatWidgetOptions.id;
        this.title.label = LocalBrainChatWidgetOptions.label;
        this.title.caption = LocalBrainChatWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-comments';
        this.addClass('local-brain-chat-widget');

        this.container = document.createElement('div');
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        this.container.style.padding = '10px';

        this.statusDiv = document.createElement('div');
        this.statusDiv.style.paddingBottom = '10px';
        this.statusDiv.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        this.statusDiv.style.marginBottom = '10px';
        this.statusDiv.style.fontSize = '12px';

        this.historyContainer = document.createElement('div');
        this.historyContainer.style.flex = '1';
        this.historyContainer.style.overflowY = 'auto';
        this.historyContainer.style.marginBottom = '10px';
        this.historyContainer.style.paddingRight = '5px';

        const inputWrapper = document.createElement('div');
        inputWrapper.style.display = 'flex';
        inputWrapper.style.flexDirection = 'column';
        inputWrapper.style.gap = '5px';

        this.inputArea = document.createElement('textarea');
        this.inputArea.placeholder = 'Ask Local Brain...';
        this.inputArea.style.width = '100%';
        this.inputArea.style.minHeight = '60px';
        this.inputArea.style.resize = 'vertical';
        this.inputArea.style.padding = '5px';

        const btnWrapper = document.createElement('div');
        btnWrapper.style.display = 'flex';
        btnWrapper.style.gap = '10px';

        this.sendButton = document.createElement('button');
        this.sendButton.innerText = 'Send';
        this.sendButton.style.padding = '5px 15px';
        this.sendButton.onclick = () => this.handleSend();

        this.stopButton = document.createElement('button');
        this.stopButton.innerText = 'Stop';
        this.stopButton.style.padding = '5px 15px';
        this.stopButton.disabled = true;
        this.stopButton.onclick = () => this.handleStop();

        btnWrapper.appendChild(this.sendButton);
        btnWrapper.appendChild(this.stopButton);

        inputWrapper.appendChild(this.inputArea);
        inputWrapper.appendChild(btnWrapper);

        const modeWrapper = document.createElement('div');
        modeWrapper.style.display = 'flex';
        modeWrapper.style.alignItems = 'center';
        modeWrapper.style.gap = '5px';
        modeWrapper.style.marginTop = '5px';
        modeWrapper.style.fontSize = '12px';

        this.proposeModeToggle = document.createElement('input');
        this.proposeModeToggle.type = 'checkbox';
        this.proposeModeToggle.id = 'codegen-mode-toggle';

        const modeLabel = document.createElement('label');
        modeLabel.innerText = 'Generate Code Change (Phase 3D)';
        modeLabel.htmlFor = 'codegen-mode-toggle';
        modeLabel.style.color = '#ccc';

        modeWrapper.appendChild(this.proposeModeToggle);
        modeWrapper.appendChild(modeLabel);

        inputWrapper.appendChild(modeWrapper);


        this.container.appendChild(this.statusDiv);
        this.container.appendChild(this.historyContainer);

        this.container.appendChild(inputWrapper);

        this.node.appendChild(this.container);

        // Listen for enter to send
        this.inputArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
    }

    @postConstruct()
    protected init(): void {
        this.chatService.onChatChunk(chunk => this.handleChunk(chunk));
        this.updateStatus();

        // Add a default system message internally (not displayed)
        this.messages.push({
            role: 'system',
            content: 'You are Local Brain, a helpful AI coding assistant.'
        });
    }

    private async updateStatus() {
        try {
            const rtStatus = await this.localBrainService.getRuntimeStatus();

            if (!rtStatus.installed) {
                this.statusDiv.innerHTML = `<span style="color: #FF9800;">Runtime: Not installed.</span><br/>Please install a runtime and download a model from the Local Brain panel.`;
                this.inputArea.disabled = true;
                this.sendButton.disabled = true;
                return;
            }

            if (rtStatus.state !== 'running') {
                this.statusDiv.innerHTML = `<span style="color: #FF9800;">Runtime: ${rtStatus.state}.</span><br/>Please start the runtime from the Local Brain panel.`;
                this.inputArea.disabled = true;
                this.sendButton.disabled = true;
                return;
            }

            this.statusDiv.innerHTML = `<span style="color: #4CAF50;">Status: Running locally</span><br/><span style="color: #ccc;">Model: ${rtStatus.activeModelId}</span>`;

            if (!this.isGenerating) {
                this.inputArea.disabled = false;
                this.sendButton.disabled = false;
            }
        } catch (e) {
            this.statusDiv.innerHTML = `<span style="color: red;">Error checking status: ${String(e)}</span>`;
        }
    }

    private appendMessageToUI(role: string, content: string, msgId?: string) {
        const div = document.createElement('div');
        if (msgId) div.id = msgId;
        div.style.marginBottom = '15px';

        const sender = document.createElement('strong');
        sender.innerText = role === 'user' ? 'You' : 'Local Brain';
        sender.style.display = 'block';
        sender.style.marginBottom = '5px';
        sender.style.color = role === 'user' ? 'cyan' : '#4CAF50';

        const body = document.createElement('div');
        body.className = 'msg-body';
        body.style.whiteSpace = 'pre-wrap';
        body.style.wordBreak = 'break-word';
        body.innerText = content;

        div.appendChild(sender);
        div.appendChild(body);

        this.historyContainer.appendChild(div);
        this.historyContainer.scrollTop = this.historyContainer.scrollHeight;
        return body;
    }


    private async handleSend() {
        const text = this.inputArea.value.trim();
        if (!text || this.isGenerating) return;

        await this.updateStatus();
        if (this.inputArea.disabled) return;

        this.inputArea.value = '';
        this.isGenerating = true;
        this.sendButton.disabled = true;
        this.stopButton.disabled = false;

        this.messages.push({ role: 'user', content: text });
        this.appendMessageToUI('user', text);

        if (this.proposeModeToggle && this.proposeModeToggle.checked) {
            // Trigger Phase 3D Codegen Flow
            this.appendMessageToUI('assistant', 'Analyzing project state and generating code proposal...');
            try {
                // Determine workspace context safely
                const workspacePath = 'default';
                const plan = await this.codegenService.createEditPlan({
                    workspacePath,
                    appPath: 'apps/web',
                    userPrompt: text,
                    mode: 'small-edit',
                    safetyLevel: 'diff-required'
                });

                const patch = await this.codegenService.generatePatch(plan.id);

                this.appendMessageToUI('assistant', `I have generated a patch: "${patch.summary}". Please open the "Code Diff Approval" panel to review and apply it.`);

                // Try to open the panel
                const commands = (window as any).theia?.commands;
                if (commands) await commands.executeCommand('localforge.codegenDiff');

            } catch (e) {
                this.appendMessageToUI('assistant', `Failed to generate code patch: ${String(e)}`);
            } finally {
                this.isGenerating = false;
                this.stopButton.disabled = true;
                this.updateStatus();
            }
            return;
        }

        // Default Chat flow
        this.currentSessionId = `chat_${Date.now()}`;
        this.appendMessageToUI('assistant', '', this.currentSessionId);

        try {
            await this.chatService.streamChatCompletion({
                sessionId: this.currentSessionId,
                messages: this.messages
            });
        } catch (e) {
            this.handleChunk({
                sessionId: this.currentSessionId,
                chunk: '',
                done: true,
                error: String(e)
            });
        }
    }

    private handleChunk(event: import('../common/protocol').LocalBrainChatChunk) {
        if (event.sessionId !== this.currentSessionId) return;

        const targetEl = this.historyContainer.querySelector(`#${event.sessionId} .msg-body`) as HTMLDivElement;

        if (event.chunk && targetEl) {
            targetEl.innerText += event.chunk;
            this.historyContainer.scrollTop = this.historyContainer.scrollHeight;
        }

        if (event.error && targetEl) {
            targetEl.innerHTML += `<br/><br/><span style="color: red;">[Error: ${event.error}]</span>`;
        }

        if (event.done) {
            if (targetEl && !event.error) {
                // Save assistant message to history
                this.messages.push({
                    role: 'assistant',
                    content: targetEl.innerText
                });
            }

            this.isGenerating = false;
            this.currentSessionId = null;
            this.stopButton.disabled = true;
            this.updateStatus(); // re-evaluates enabled states
        }
    }

    private async handleStop() {
        if (this.currentSessionId) {
            await this.chatService.cancelGeneration(this.currentSessionId);
            this.stopButton.disabled = true;
        }
    }
}
