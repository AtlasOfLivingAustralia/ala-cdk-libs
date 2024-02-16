import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

import { AppContext, PipelineBaseStack, StackConfig } from '@ala/ala-cdk-libs';


export class PipelineStack extends PipelineBaseStack {

  constructor(appContext: AppContext, stackConfig: StackConfig) {

    super(appContext, 'Pipeline', stackConfig);

    const sourceArtifact = new codepipeline.Artifact()
    const buildArtifact = new codepipeline.Artifact()

    this.addGitSourceStage(sourceArtifact, {
      owner: stackConfig.Parameters.owner,
      repo: stackConfig.Parameters.repo,
      branch: stackConfig.Parameters.branch,
      connectionArn: stackConfig.Parameters.connectionArn,
    })

    this.codePipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build-ALA-CDK-libs',
          project: new codebuild.PipelineProject(this, 'build', {
            environment: {
              buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5
            },
            environmentVariables: {
              NEXUS_BASIC_AUTH: { 
                value: 'test/cicd/ala-cdk-libs:nexus_basic_auth',
                type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER
              }
            },
            buildSpec: codebuild.BuildSpec.fromObject({
              version: '0.2',
              phases: {
                install: {
                  commands: [
                    'npm install'
                  ]
                },
                pre_build: {
                  commands: [
                    'echo "//nexus.ala.org.au/repository/js-snapshots/:_auth=\"${NEXUS_BASIC_AUTH}\"" >> .npmrc',
                    'cat .npmrc'
                  ]
                },
                build: {
                  commands: [
                    'npm run build'
                  ]
                },
                post_build: {
                  commands: [
                    'npm publish'
                  ]
                }
              }
            })
          }),
          input: sourceArtifact,
        })
      ]
    })
  }

}
