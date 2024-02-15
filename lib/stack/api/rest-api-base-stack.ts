import { IRestApi } from "aws-cdk-lib/aws-apigateway";
import { BaseStack } from "../base/base-stack";
import { AppContext } from "../../app-context";
import { StackConfig } from "../../app-config";
import { AlaRestApi } from "../../construct/pattern/ala-rest-api";

export abstract class RestApiBaseStack extends BaseStack {

    readonly restApi: AlaRestApi

    constructor(appContext: AppContext, stackConfig: StackConfig) {

        super(appContext, stackConfig);

        this.restApi = new AlaRestApi(this, {
            deployOptions: {
                stageName: appContext.appConfig.Project.Stage.toLowerCase()
            },
            // projectPrefix: this.projectPrefix,
            // stackName: this.stackName,
            // // env: this.commonProps.env,
            // variables: this.commonProps.variables
        })
    }

}