import * as apigateway from "aws-cdk-lib/aws-apigateway";

import { BaseStack } from "../../stack/base/base-stack";


export interface AlaRestApiProps extends apigateway.RestApiProps {


}

export interface IAlaAuthorizer {
    authorizationScopes?: string[]
    authorizationType?: apigateway.AuthorizationType
    authorizer?: apigateway.IAuthorizer
}

export interface AlaSpecOptions {

    integrationUrl?: string
    excludeDeprecated?: boolean
    excludePaths?: Paths
    mapPaths?: { [ path: string ]: string }
    authorizer?: { [ schema: string ]: IAlaAuthorizer }
}

type Paths = { [ path: string ]: Method }
type Method = 'ANY' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT'


export class AlaRestApi extends apigateway.RestApi {

    constructor(scope: BaseStack, props: AlaRestApiProps) {

        super(scope, scope.withProjectPrefix('Rest-API'), props)
    }


    public loadSpecUrl(url: string, options: AlaSpecOptions = { }) {

        fetch(url)
            .then((resp: Response) => {
                return resp.json()
            }).then((json: any) => {
                this.loadSpec(json, options)
            })
    }

    /**
     * load an OpenAPI specification in JSON format
     * 
     * @param spec the OpenAPI spec object
     */
    public loadSpec(spec: any, options: AlaSpecOptions = { }) {

        Object.entries(spec.paths).forEach(([ path, methods ]: [ string, any ]) => {

            let activeMethods = Object.entries(methods)
                .filter(([ _, spec ]: [ string, any ]) => (!options.excludeDeprecated || !spec.deprecated))
  
            if (activeMethods.length > 0) {
                
                if (options.excludePaths && options.excludePaths[path]) {

                    const excludeMethod = options.excludePaths[path]

                    if (excludeMethod === 'ANY') {
                        activeMethods = []
                    }

                    activeMethods = activeMethods.filter(([ method, _ ]: [ string, any ]) => method.toUpperCase() !== excludeMethod)
                }
            }
            
            if (activeMethods.length > 0) {

                if (options.mapPaths && options.mapPaths[path]) {
                
                    path = options.mapPaths[path]
                }

                const resource = this.root.resourceForPath(path)

                activeMethods.forEach(([ method, spec ]: [ string, any ]) => {

                    let integration!: apigateway.Integration
                    let methodOptions: any

                    if (options.integrationUrl) {

                        let integrationProps: any = {
                            httpHethod: method.toUpperCase()
                        }

                        if (spec.parameters) {

                            let integrationReqParams!: { [ key: string ]: string }
                            let methodReqParams!: { [ key: string ]: boolean }

                            spec.parameters
                                .filter((param: any) => !param.deprecated)
                                .forEach((param: any) => {

                                    if (param.in === 'query') {

                                        if (!integrationReqParams) { integrationReqParams = {} as any }
                                        if (!methodReqParams) { methodReqParams = {} as any }

                                        integrationReqParams[`integration.request.querystring.${param.name}`] = `method.request.querystring.${param.name}`
                                        methodReqParams[`method.request.querystring.${param.name}`] = !!param.required

                                    } else if (param.in === 'path') {

                                        if (!integrationReqParams) { integrationReqParams = {} as any }
                                        if (!methodReqParams) { methodReqParams = {} as any }

                                        integrationReqParams[`integration.request.path.${param.name}`] = `method.request.path.${param.name}`
                                        methodReqParams[`method.request.path.${param.name}`] = !!param.required
                                    }
                                })

                            if (integrationReqParams) {
                                integrationProps['options'] = {} as any
                                integrationProps['options']['requestParameters'] = integrationReqParams
                            }

                            if (methodReqParams) {
                                methodOptions = {
                                    requestParameters: methodReqParams
                                }
                            }
                        }

                        integration = new apigateway.HttpIntegration(`${options.integrationUrl}${path}`)
                    }

                    if (options.authorizer && spec.security) {

                        spec.security.forEach((security: any) => {

                            const securityObj = Object.entries(security).at(0)
                            
                            if (options.authorizer && securityObj && options.authorizer[securityObj[0]]) {

                                const authorizer = options.authorizer[securityObj[0]]

                                if (!methodOptions) {
                                    methodOptions = {}
                                }

                                methodOptions.authorizationType = authorizer.authorizationType
                                methodOptions.authorizer = authorizer.authorizer

                                if (authorizer.authorizationType === apigateway.AuthorizationType.COGNITO) {

                                    methodOptions.authorizationScopes = authorizer.authorizationScopes?.concat(securityObj[1] as string[])
                                }
                            }
                        })
                    }

                    resource.addMethod(method, integration, methodOptions)
                })
            }
        })
    }
}