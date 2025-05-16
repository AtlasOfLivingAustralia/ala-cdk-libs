import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

import { BaseStack } from "../../stack/base/base-stack";

export interface AlaPipelineProps extends codepipeline.PipelineProps {

}

export interface ISourceProps {

    /**
     * The ARN of the CodeStar Connection created in the AWS console
     * that has permissions to access this GitHub or BitBucket repository.
     *
     * @example 'arn:aws:codestar-connections:us-east-1:123456789012:connection/12345678-abcd-12ab-34cdef5678gh'
     * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/connections-create.html
     */
    readonly connectionArn: string;

    readonly owner: string;

    /**
     * The name of the repository.
     *
     * @example 'aws-cdk'
     */
    readonly repo: string;

    /**
     * The branch to build.
     *
     * @default 'master'
     */
    readonly branch?: string;

    /**
     * Whether the output should be the contents of the repository
     * (which is the default),
     * or a link that allows CodeBuild to clone the repository before building.
     *
     * **Note**: if this option is true,
     * then only CodeBuild actions can use the resulting `output`.
     *
     * @default false
     * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-CodestarConnectionSource.html#action-reference-CodestarConnectionSource-config
     */
    readonly codeBuildCloneOutput?: boolean;

    /**
     * Controls automatically starting your pipeline when a new commit
     * is made on the configured repository and branch. If unspecified,
     * the default value is true, and the field does not display by default.
     *
     * @default true
     * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-CodestarConnectionSource.html
     */
    readonly triggerOnPush?: boolean;

    pushFilter?: codepipeline.GitPushFilter[]

    pullRequestFilter?: codepipeline.GitPullRequestFilter[]
}

export interface ICdkProps {
    baseDirectory?: string
    configFile: string
    configPath?: string
    stackName: string
    parameterOverrides?: { [key: string]: string }
}

export class AlaPipeline extends codepipeline.Pipeline {

    private _sourceArtifact: codepipeline.Artifact

    constructor(scope: BaseStack, props?: AlaPipelineProps) {

        super(scope, scope.withProjectPrefix('Pipeline'), {
            pipelineName: scope.stackName,
            pipelineType: codepipeline.PipelineType.V2,
            ...props
        })
    }

    getSourceArtifact(): codepipeline.Artifact {
        return this._sourceArtifact ? this._sourceArtifact : new codepipeline.Artifact('source')
    }

    addSourceStage(sourceArtifact: codepipeline.Artifact, sourceProps: ISourceProps) {

        const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
            actionName: 'Checkout',
            codeBuildCloneOutput: true,
            triggerOnPush: true,
            ...sourceProps,
            output: sourceArtifact
        })

        this.addStage({
            stageName: 'Source-Code',
            actions: [sourceAction]
        })

        if (sourceProps.pushFilter || sourceProps.pullRequestFilter) {

            this.addTrigger({
                providerType: codepipeline.ProviderType.CODE_STAR_SOURCE_CONNECTION,
                gitConfiguration: {
                    sourceAction: sourceAction,
                    pushFilter: sourceProps.pushFilter,
                    pullRequestFilter: sourceProps.pullRequestFilter
                }
            })
        }
    }

    addCdkStage(cdkProps: ICdkProps): codepipeline.Artifact {

        const buildArtifact = new codepipeline.Artifact()
        const stackArtifact = new codepipeline.Artifact('InfraStack')

        this.addStage({
            stageName: 'Build-Infrastruture',
            actions: [
                new codepipeline_actions.CodeBuildAction({
                    actionName: 'Synthesize-CF-Template',
                    project: new codebuild.PipelineProject(this, 'cdk-synth', {
                        environment: {
                            buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5
                        },
                        buildSpec: codebuild.BuildSpec.fromObject({
                            version: '0.2',
                            phases: {
                                pre_build: {
                                    commands: [
                                        `cd ${cdkProps.baseDirectory ? cdkProps.baseDirectory : 'cicd'}`,
                                        'npm install'
                                    ]
                                },
                                build: {
                                    commands: [
                                        `npx cdk synth \'${cdkProps.stackName}\' --context APP_CONFIG=${cdkProps.configPath ? cdkProps.configPath : 'config'}/${cdkProps.configFile}`
                                    ]
                                },
                            },
                            artifacts: {
                                'base-directory': `./${cdkProps.baseDirectory ? cdkProps.baseDirectory : 'cicd'}/cdk.out`,
                                files: '**/**'
                            }
                        })
                    }),
                    input: this.getSourceArtifact(),
                    outputs: [ buildArtifact ],
                    runOrder: 1
                }),
                new codepipeline_actions.CloudFormationCreateUpdateStackAction({
                    actionName: `Update-${cdkProps.stackName}-Stack`,
                    stackName: cdkProps.stackName,
                    templatePath: buildArtifact.atPath(`${cdkProps.stackName}.template.json`),
                    adminPermissions: true,
                    output: stackArtifact,
                    outputFileName: `${cdkProps.stackName}.output.json`,
                    parameterOverrides: cdkProps.parameterOverrides,
                    runOrder: 2
                })
            ]
        })

        return stackArtifact
    }

}