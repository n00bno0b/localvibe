import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MessageService } from '@theia/core/lib/common/message-service';
import { injectable, inject } from '@theia/core/shared/inversify';

export const AppBlueprintCommand = {
    id: 'localforge.appBlueprint.new',
    label: 'LocalForge: New App Blueprint'
};

@injectable()
export class AppBlueprintCommandContribution implements CommandContribution {
    constructor(
        @inject(MessageService) private readonly messageService: MessageService
    ) {}

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(AppBlueprintCommand, {
            execute: () => {
                this.messageService.info('App Blueprint builder opening... (Coming Soon in Phase 3)');
            }
        });
    }
}

export default new ContainerModule(bind => {
    bind(CommandContribution).to(AppBlueprintCommandContribution).inSingletonScope();
});
