

import * as iam from 'aws-cdk-lib/aws-iam';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

import * as base from '../base/base-stack';
import { AppContext } from '../../app-context';
import { StackConfig } from '../../app-config'
import { PipelineBaseStack } from './pipeline-base-stack';

export interface ICdkSynthBuildProps {
    baseDirectory?: string
    configFile?: string
}

export abstract class CdkPipelineBaseStack extends PipelineBaseStack {

    protected onBuildPolicies(): iam.PolicyStatement[] | undefined {
        return undefined
    }

    constructor(appContext: AppContext, pipelineBaseName: string, stackConfig: StackConfig) {

        super(appContext, pipelineBaseName, stackConfig);

    }

    addSynthBuildStage(sourceArtifact: codepipeline.Artifact, cdkSynthBuildProps: ICdkSynthBuildProps): codepipeline.Artifact {

        const buildArtifact = new codepipeline.Artifact()

        this.codePipeline.addStage({
            stageName: 'Build',
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
                                        `cd ${cdkSynthBuildProps.baseDirectory ? cdkSynthBuildProps.baseDirectory : './'}}`,
                                        'npm install'
                                    ]
                                },
                                build: {
                                    commands: [
                                        'npx cdk synth \'*API-Stack\' --context APP_CONFIG=config/biocache-config-test.json'
                                    ]
                                },
                            },
                            artifacts: {
                                'base-directory': `${cdkSynthBuildProps.baseDirectory ? cdkSynthBuildProps.baseDirectory : '.'}/infra/cdk.out`,
                                files: '**/**'
                            }
                        })
                    }),
                    input: sourceArtifact,
                    outputs: [buildArtifact]
                })
            ]
        })

        return buildArtifact
    }

    addCloudFormationStage(templatePath: codepipeline.ArtifactPath) {

        this.codePipeline.addStage({
            stageName: 'Deploy',
            actions: [
              new codepipeline_actions.CloudFormationCreateUpdateStackAction({
                actionName: 'Update-Biocache-Service-Test-API-Stack',
                stackName: 'Biocache-Service-Test-API-Stack',
                templatePath: templatePath,
                adminPermissions: true
              })
            ]
          })
    }
}
