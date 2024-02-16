

import * as iam from 'aws-cdk-lib/aws-iam';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';

import * as base from '../base/base-stack';
import { AppContext } from '../../app-context';
import { StackConfig } from '../../app-config'

export interface IGitProps {
    owner: string,
    repo: string,
    branch: string,
    connectionArn: string
}

export abstract class PipelineBaseStack extends base.BaseStack {

    public codePipeline: codepipeline.Pipeline;

    protected onBuildPolicies(): iam.PolicyStatement[] | undefined {
        return undefined
    }

    constructor(appContext: AppContext, pipelineBaseName: string, stackConfig: StackConfig) {

        super(appContext, stackConfig);

        this.codePipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            pipelineName: `${this.projectPrefix}-${pipelineBaseName}`,
            pipelineType: codepipeline.PipelineType.V2,
            enableKeyRotation: true
        });
    }

    addGitSourceStage(sourceArtifact: codepipeline.Artifact, gitProps: IGitProps) {

        this.codePipeline.addStage({
            stageName: 'Source-Code',
            actions: [
                this.createGitSourceAction(sourceArtifact, gitProps)
            ]
        })
    }

    createGitSourceAction(sourceArtifact: codepipeline.Artifact, gitProps: IGitProps): codepipeline.IAction {

        return new codepipeline_actions.CodeStarConnectionsSourceAction({
            actionName: 'Checkout',
            owner: gitProps.owner,
            repo: gitProps.repo,
            branch: gitProps.branch,
            output: sourceArtifact,
            connectionArn: gitProps.connectionArn,
            codeBuildCloneOutput: true
        })
    }
}
