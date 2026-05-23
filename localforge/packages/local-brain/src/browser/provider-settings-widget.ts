import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { BaseWidget } from '@theia/core/lib/browser';
import { AIProviderRegistry, AIProviderInfo, ProviderRoutingMode } from '../common/protocol';

export const ProviderSettingsWidgetOptions = {
    id: 'localforge-provider-settings-widget',
    label: 'AI Provider Settings'
};

@injectable()
export class ProviderSettingsWidget extends BaseWidget {

    @inject(AIProviderRegistry)
    protected readonly registry!: AIProviderRegistry;

    private container: HTMLDivElement;

    private providers: AIProviderInfo[] = [];
    private currentProviderId: string = '';
    private routingMode: ProviderRoutingMode = 'ask';

    constructor() {
        super();
        this.id = ProviderSettingsWidgetOptions.id;
        this.title.label = ProviderSettingsWidgetOptions.label;
        this.title.caption = ProviderSettingsWidgetOptions.label;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-cog';
        this.addClass('localforge-provider-settings-widget');

        this.container = document.createElement('div');
        this.container.style.padding = '15px';
        this.container.style.overflowY = 'auto';
        this.container.style.height = '100%';

        this.node.appendChild(this.container);
    }

    @postConstruct()
    protected async init(): Promise<void> {
        await this.loadData();
    }

    private async loadData() {
        try {
            this.providers = await this.registry.listProviders();
            const active = await this.registry.getActiveProvider();
            this.currentProviderId = active.id;
            this.routingMode = await this.registry.getRoutingMode();
            this.render();
        } catch (e) {
            this.container.innerHTML = `<div style="color: red;">Error loading providers: ${String(e)}</div>`;
        }
    }

    private render() {
        const providerOptions = this.providers.map(p =>
            `<option value="${p.id}" ${p.id === this.currentProviderId ? 'selected' : ''}>${p.displayName} (${p.type})</option>`
        ).join('');

        const modes = ['ask', 'local-first', 'cloud-first', 'local-only', 'mock'];
        const modeOptions = modes.map(m =>
            `<option value="${m}" ${m === this.routingMode ? 'selected' : ''}>${m}</option>`
        ).join('');

        this.container.innerHTML = `
            <h2 style="margin-top: 0;">AI Provider Settings</h2>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #ccc;">Active Provider</label>
                <select id="prov-active" style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #555;">
                    ${providerOptions}
                </select>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #ccc;">Routing Policy</label>
                <select id="prov-routing" style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #555;">
                    ${modeOptions}
                </select>
            </div>

            <div style="margin-bottom: 20px; padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid #444; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px;">Cloud API Keys (BYOK)</h3>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #ccc;">OpenAI API Key</label>
                    <input id="prov-openai-key" type="password" placeholder="sk-..." style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #555; margin-bottom: 10px;" />
                    <button id="prov-save-openai-key" style="padding: 4px 10px; background: #007acc; color: white; border: none; cursor: pointer;">Save Key & Test Connection</button>
                    <div id="prov-test-openai-res" style="margin-top: 10px; font-size: 12px;"></div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #ccc;">Anthropic API Key</label>
                    <input id="prov-anthropic-key" type="password" placeholder="sk-ant-..." style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #555; margin-bottom: 10px;" />
                    <button id="prov-save-anthropic-key" style="padding: 4px 10px; background: #007acc; color: white; border: none; cursor: pointer;">Save Key & Test Connection</button>
                    <div id="prov-test-anthropic-res" style="margin-top: 10px; font-size: 12px;"></div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #ccc;">Google Gemini API Key</label>
                    <input id="prov-gemini-key" type="password" placeholder="AIza..." style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #555; margin-bottom: 10px;" />
                    <button id="prov-save-gemini-key" style="padding: 4px 10px; background: #007acc; color: white; border: none; cursor: pointer;">Save Key & Test Connection</button>
                    <div id="prov-test-gemini-res" style="margin-top: 10px; font-size: 12px;"></div>
                </div>
            </div>
        `;

        const activeSelect = this.container.querySelector('#prov-active') as HTMLSelectElement;
        activeSelect.addEventListener('change', async () => {
            await this.registry.setActiveProvider(activeSelect.value);
            this.loadData();
        });

        const routingSelect = this.container.querySelector('#prov-routing') as HTMLSelectElement;
        routingSelect.addEventListener('change', async () => {
            await this.registry.setRoutingMode(routingSelect.value as ProviderRoutingMode);
            this.loadData();
        });

        const setupConnectionTest = (providerId: string, providerName: string, btnId: string, inputId: string, resId: string) => {
            const saveKeyBtn = this.container.querySelector(`#${btnId}`) as HTMLButtonElement;
            saveKeyBtn.addEventListener('click', async () => {
                const keyInput = this.container.querySelector(`#${inputId}`) as HTMLInputElement;
                const key = keyInput.value.trim();
                if (!key) return;

                saveKeyBtn.disabled = true;
                saveKeyBtn.innerText = 'Testing...';
                const resDiv = this.container.querySelector(`#${resId}`)!;

                try {
                    await this.registry.setCredentials({ providerId, apiKey: key });
                    const status = await this.registry.checkConnection(providerId);

                    if (status.connected) {
                        resDiv.innerHTML = `<span style="color: #4CAF50;">Successfully connected to ${providerName}!</span>`;
                        keyInput.value = '';
                    } else {
                        resDiv.innerHTML = `<span style="color: #ff5555;">Connection failed: ${status.error}</span>`;
                    }
                } catch (err) {
                    resDiv.innerHTML = `<span style="color: #ff5555;">Error: ${String(err)}</span>`;
                } finally {
                    saveKeyBtn.disabled = false;
                    saveKeyBtn.innerText = 'Save Key & Test Connection';
                }
            });
        };

        setupConnectionTest('openai-provider', 'OpenAI', 'prov-save-openai-key', 'prov-openai-key', 'prov-test-openai-res');
        setupConnectionTest('anthropic-provider', 'Anthropic', 'prov-save-anthropic-key', 'prov-anthropic-key', 'prov-test-anthropic-res');
        setupConnectionTest('gemini-provider', 'Google Gemini', 'prov-save-gemini-key', 'prov-gemini-key', 'prov-test-gemini-res');
    }
}
