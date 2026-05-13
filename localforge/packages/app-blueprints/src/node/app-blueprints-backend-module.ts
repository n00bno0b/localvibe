import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import {
    ForgeScoutService, ForgeScoutServicePath,
    ProjectGeneratorService, ProjectGeneratorServicePath,
    PreviewService, PreviewServicePath,
    DependencyDoctorService, DependencyDoctorServicePath,
    ForgeConductorService, ForgeConductorServicePath
} from '../common/protocol';
import { AICodegenService, AICodegenServicePath } from '../../../local-brain/src/common/protocol';
import { ForgeConductorServiceImpl } from './forge-conductor-service-impl';
import { ForgeScoutServiceImpl } from './forge-scout-service-impl';
import { ProjectGeneratorServiceImpl } from './project-generator-service-impl';
import { PreviewServiceImpl } from './preview-service-impl';
import { DependencyDoctorServiceImpl } from './dependency-doctor-service-impl';
import { AICodegenServiceImpl } from './codegen-service-impl';

export default new ContainerModule(bind => {
    bind(ForgeConductorService).to(ForgeConductorServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(ForgeConductorServicePath, () => {
            return ctx.container.get<ForgeConductorService>(ForgeConductorService);
        })
    ).inSingletonScope();

    bind(ForgeScoutService).to(ForgeScoutServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(ForgeScoutServicePath, () => {
            return ctx.container.get<ForgeScoutService>(ForgeScoutService);
        })
    ).inSingletonScope();

    bind(ProjectGeneratorService).to(ProjectGeneratorServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(ProjectGeneratorServicePath, () => {
            return ctx.container.get<ProjectGeneratorService>(ProjectGeneratorService);
        })
    ).inSingletonScope();

    bind(PreviewServiceImpl).toSelf().inSingletonScope();
    bind(PreviewService).toService(PreviewServiceImpl);
    bind(BackendApplicationContribution).toService(PreviewServiceImpl);

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(PreviewServicePath, () => {
            return ctx.container.get<PreviewService>(PreviewService);
        })
    ).inSingletonScope();

    bind(DependencyDoctorService).to(DependencyDoctorServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(DependencyDoctorServicePath, () => {
            return ctx.container.get<DependencyDoctorService>(DependencyDoctorService);
        })
    ).inSingletonScope();

    bind(AICodegenService).to(AICodegenServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(AICodegenServicePath, () => {
            return ctx.container.get<AICodegenService>(AICodegenService);
        })
    ).inSingletonScope();
});
