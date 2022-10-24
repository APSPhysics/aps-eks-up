import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { EksCluster } from "./constructs/eks-cluster";
import { EksClusterArgo } from "./constructs/eks-cluster-argo";
import { Cluster, ServiceAccount } from "aws-cdk-lib/aws-eks";
import { EksClusterExternalSecrets } from "./constructs/eks-cluster-external-secrets";

export type EksNetworkAccessGrant = {
  targetSgId: string;
  port: ec2.Port;
};

export type EksClusterStackProps = StackProps & {
  vpcId: string;
  appName: string;
  privateVpcSubnetIds: string[];
  argoGithubUrl: string;
  githubTokenSecretPath: string;
  clusterNodeCount: number;
  clusterInstanceType: ec2.InstanceType;
  clusterName: string;
  secretsPrefix: string;
  networkAccessGrants: EksNetworkAccessGrant[];
};

export class EksClusterStack extends cdk.Stack {
  readonly cluster: Cluster;
  readonly serviceAccount: ServiceAccount;

  constructor(scope: Construct, id: string, props: EksClusterStackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "EksVpc", {
      vpcId: props.vpcId,
    });

    const cluster = new EksCluster(this, "EksClusterStack", {
      vpc,
      privateVpcSubnetIds: props.privateVpcSubnetIds,
      clusterName: props.clusterName,
      clusterNodeCount: props.clusterNodeCount,
      networkAccessGrants: props.networkAccessGrants,
      clusterInstanceType: props.clusterInstanceType,
    }).cluster;

    new EksClusterArgo(this, "EksHelmClusterBootstrap", {
      cluster,
    });

    const esConstruct = new EksClusterExternalSecrets(this, "ExternalSecrets", {
      secretsPrefix: props.secretsPrefix,
      cluster: cluster,
      argoGithubUrl: props.argoGithubUrl,
      githubTokenSecretPath: props.githubTokenSecretPath,
    });

    this.cluster = cluster;
    this.serviceAccount = esConstruct.serviceAccount;
  }
}
