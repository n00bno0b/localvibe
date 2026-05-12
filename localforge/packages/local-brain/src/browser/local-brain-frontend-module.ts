import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MessageService } from '@theia/core/lib/common/message-service';
import { injectable, inject } from '@theia/core/shared/inversify';

export const LocalBrainCommand = {
    id: 'localforge.localBrain.status',
    label: 'LocalForge: Local Brain Status'
};

@injectable()
export class LocalBrainCommandContribution implements CommandContribution {
    constructor(
        @inject(MessageService) private readonly messageService: MessageService
    ) {}

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(LocalBrainCommand, {
            execute: () => {
                this.messageService.info('Local Brain: Not installed yet. Modes: Fast / Balanced / Powerful. Coming soon: built-in local model runtime.');
            }
        });
    }
}

export default new ContainerModule(bind => {
    bind(CommandContribution).to(LocalBrainCommandContribution).inSingletonScope();
});
