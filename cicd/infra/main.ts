#!/usr/bin/env node
import 'source-map-support/register';
import { PipelineStack } from './stack/cicd-pipeline-stack';
import { AppContext, AppContextError, ProjectPrefixType } from '@ala/ala-cdk-libs';

try {

  const appContext = new AppContext({
      appConfigFileKey: 'APP_CONFIG',
      projectPrefixType: ProjectPrefixType.NameHyphenStage,
      
  });

  new PipelineStack(appContext, appContext.appConfig.Stack.Pipeline);

} catch (error) {
  if (error instanceof AppContextError) {
      console.error('[AppContextError]:', (error as AppContextError).message);
  } else {
      console.error('[Error]: not-handled-error', error);
  }
}