import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { QuickPickService } from '@theia/core/lib/browser';
import { LocalBrainWidget, LocalBrainWidgetOptions } from './local-brain-widget';
import { LocalBrainChatWidget, LocalBrainChatWidgetOptions } from './local-brain-chat-widget';
import { LocalBrainService } from '../common/protocol';

export const LocalBrainSetModeCommand = {
    id: 'localforge.localBrain.setMode',
    label: 'LocalForge: Set Local Brain Mode'
};

@injectable()
export class LocalBrainViewContribution extends AbstractViewContribution<LocalBrainWidget> {
    constructor() {
        super({
            widgetId: LocalBrainWidgetOptions.id,
            widgetName: LocalBrainWidgetOptions.label,
            defaultWidgetOptions: { area: 'left' },
            toggleCommandId: 'localBrain:toggle'
        });
    }
}

@injectable()
export class LocalBrainChatViewContribution extends AbstractViewContribution<LocalBrainChatWidget> {
    constructor() {
        super({
            widgetId: LocalBrainChatWidgetOptions.id,
            widgetName: LocalBrainChatWidgetOptions.label,
            defaultWidgetOptions: { area: 'left' },
            toggleCommandId: 'localBrainChat:toggle'
        });
    }
}

@injectable()
export class LocalBrainCommandContribution implements CommandContribution {
    constructor(
        @inject(LocalBrainService) private readonly localBrainService: LocalBrainService,
        @inject(QuickPickService) private readonly quickPickService: QuickPickService,
        @inject(LocalBrainViewContribution) private readonly viewContribution: LocalBrainViewContribution
    ) {}

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(LocalBrainSetModeCommand, {
            execute: async () => {
                const modes = await this.localBrainService.listModes();
                const items = modes.map(m => ({
                    label: m.label,
                    description: m.description,
                    value: m.id
                }));
                const selected = await this.quickPickService.show(items, {
                    title: 'Select Local Brain Mode',
                    placeholder: 'Choose a mode...'
                });
                if (selected) {
                    await this.localBrainService.setActiveMode(selected.value);
                    const widget = await this.viewContribution.widget;
                    if (widget) {
                        widget.update();
                    }
                }
            }
        });
    }
}
