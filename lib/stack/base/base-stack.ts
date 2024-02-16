import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ssm from 'aws-cdk-lib/aws-ssm'

import { AppContext } from '../../app-context'
import { AppConfig, StackConfig } from '../../app-config'



export function Override(target: any, propertyKey: string, descriptor: PropertyDescriptor){}

export interface StackCommonProps extends cdk.StackProps {
    projectPrefix: string;
    appConfig: AppConfig;
    appConfigPath: string;
    // env: cdk.Environment;
    variables: any;
}

export class BaseStack extends cdk.Stack {
    protected stackConfig: StackConfig;
    protected projectPrefix: string;
    protected commonProps: StackCommonProps;

    constructor(appContext: AppContext, stackConfig: StackConfig) {
        
        let newProps = BaseStack.getStackCommonProps(appContext, stackConfig);

        super(appContext.cdkApp, stackConfig.Name, newProps);

        this.stackConfig = stackConfig;
        this.commonProps = newProps;
        this.projectPrefix = appContext.stackCommonProps.projectPrefix;
    }

    private static getStackCommonProps(appContext: AppContext, stackConfig: StackConfig): StackCommonProps{
        let newProps = appContext.stackCommonProps;
        if (stackConfig.UpdateRegionName) {
            console.log(`[INFO] Region is updated: ${stackConfig.Name} ->> ${stackConfig.UpdateRegionName}`);
            newProps = {
                ...appContext.stackCommonProps,
                env: {
                    region: stackConfig.UpdateRegionName,
                    account: appContext.appConfig.Project.Account
                }
            };
        } else {
            // console.log('not update region')
        }

        return newProps;
    }

    // findEnumType<T extends object>(enumType: T, target: string): T[keyof T] {
    //     return this.commonHelper.findEnumType(enumType, target);
    // }

    exportOutput(key: string, value: string, prefixEnable=true, prefixCustomName?: string) {
        
        if (prefixEnable) {
            const prefix = prefixCustomName ? prefixCustomName : this.projectPrefix;
            new cdk.CfnOutput(this.stackConfig.construct, `Output-${key}`, {
                exportName: `${prefix}-${key}`,
                value: value
            });
        } else {
            new cdk.CfnOutput(this.stackConfig.construct, `Output-${key}`, {
                exportName: key,
                value: value
            });
        }
    }

    putParameter(paramKey: string, paramValue: string, prefixEnable=true, prefixCustomName?: string): string {
        
        if (prefixEnable) {
            const paramKeyWithPrefix = prefixCustomName ? `${prefixCustomName}-${paramKey}` : `${this.projectPrefix}-${paramKey}`;

            new ssm.StringParameter(this.stackConfig.construct, paramKey, {
                parameterName: paramKeyWithPrefix,
                stringValue: paramValue,
            });
        } else {
            new ssm.StringParameter(this.stackConfig.construct, paramKey, {
                parameterName: paramKey,
                stringValue: paramValue,
            });
        }

        return paramKey;
    }

    getParameter(paramKey: string, prefixEnable=true, prefixCustomName?: string): string {

        if (prefixEnable) {
            const paramKeyWithPrefix = prefixCustomName ? `${prefixCustomName}-${paramKey}` : `${this.projectPrefix}-${paramKey}`;

            return ssm.StringParameter.valueForStringParameter(
                this.stackConfig.construct,
                paramKeyWithPrefix
            );
        } else {
            return ssm.StringParameter.valueForStringParameter(
                this.stackConfig.construct,
                paramKey
            );
        }
    }

    putVariable(variableKey: string, variableValue: string) {
        this.stackConfig.variables[variableKey] = variableValue;
    }

    getVariable(variableKey: string): string {
        return this.stackConfig.variables[variableKey];
    }

    createS3BucketName(baseName: string, suffix?: boolean): string {

        if (suffix === undefined || suffix === true) {
            const finalSuffix = `${this.stackConfig.env?.region}-${this.stackConfig.env?.account?.substr(0, 5)}`
            return `${this.stackName}-${baseName}-${finalSuffix}`.toLowerCase().replace('_', '-');
        } else {
            return `${this.stackName}-${baseName}`.toLowerCase().replace('_', '-');
        }
    }

    createS3Bucket(baseName: string, suffix?: boolean, encryption?: s3.BucketEncryption, versioned?: boolean): s3.Bucket {
        
        const bucketName = this.createS3BucketName(baseName, suffix);

        const s3Bucket = new s3.Bucket(this.stackConfig.construct, `${baseName}-bucket`, {
            bucketName: bucketName,
            encryption: encryption == undefined ? s3.BucketEncryption.S3_MANAGED : encryption,
            versioned: versioned == undefined ? false : versioned,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });

        return s3Bucket;
    }

    withStackName(baseName: string, delimiter='-'): string {
        return `${this.stackName}${delimiter}${baseName}`;
    }

    withProjectPrefix(baseName: string, delimiter='-'): string {
        return `${this.projectPrefix}${delimiter}${baseName}`;
    }
}
