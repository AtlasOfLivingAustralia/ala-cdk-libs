import { CfnOutput, IResource, Resource } from "aws-cdk-lib"
import { Construct } from "constructs"

import * as cert from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as route53 from "aws-cdk-lib/aws-route53"
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as s3 from 'aws-cdk-lib/aws-s3'

export interface IStaticSpa extends IResource {

    readonly bucket: s3.IBucket
    readonly distribution: cloudfront.IDistribution
}

export interface StaticSpaProps {

    /**
     * the entry page of the SPA
     * 
     * @default - '/index.html'
     */
    readonly entryPage?: string

    /**
     * An optional path that CloudFront appends to the origin domain name when CloudFront requests content from the origin.
     *
     * Must begin, but not end, with '/' (e.g., '/www').
     * 
     *  @default - '/'
     */
    readonly originPath?: string

    readonly customDomain?: ICustomDomain
}

export interface ICustomDomain {

    readonly hostedZone: route53.IHostedZone
    readonly domainNames: string[]
    readonly certificate: cert.ICertificate
}

export class StaticSpa extends Resource implements IStaticSpa {

    public readonly bucket: s3.IBucket
    public readonly distribution: cloudfront.IDistribution

    constructor(scope: Construct, id: string, props: StaticSpaProps) {

        super(scope, id)

        this.bucket = new s3.Bucket(this, 'Bucket', {
            accessControl: s3.BucketAccessControl.PRIVATE,
        })

        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultRootObject: props.entryPage ?? undefined,
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
                    originPath: props.originPath ?? '/'
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },
            errorResponses: [{
                httpStatus: 403,
                responseHttpStatus: 200,
                responsePagePath: props.entryPage ?? '/index.html'
            }, {
                httpStatus: 404,
                responseHttpStatus: 200,
                responsePagePath: props.entryPage ?? '/index.html'
            }],
            domainNames: props.customDomain?.domainNames ?? undefined,
            certificate: props.customDomain?.certificate ?? undefined
        })

        if (props.customDomain?.hostedZone) {

            const zone = props.customDomain?.hostedZone
            const zoneName = zone.zoneName

            props.customDomain.domainNames
                .forEach((domainName: string) => {

                    if (domainName.endsWith(zoneName)) {

                        new route53.ARecord(this, `AliasRecord-${domainName}`, {
                            zone,
                            recordName: `${domainName}.`,
                            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
                        })
                    }
                })
        }
    }
}