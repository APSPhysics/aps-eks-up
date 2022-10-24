#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { EksClusterStack } from "../src/eks-cluster-stack";
import { Tags } from "aws-cdk-lib";
import { Port } from "aws-cdk-lib/aws-ec2";

const app = new cdk.App();
new EksClusterStack(app, "EksCluster", {
  env: { account: "your-account-no", region: "your-region" },
  vpcId: "your-vpc",
  appName: "your-app-name",
  // This is the repo that contains your agro defined apps and k8s charts
  argoGithubUrl: "https://github.com/path-to-your-repo",
  // Secret key path to your github token that can access the argo repo
  githubTokenSecretPath: "prod/GithubToken",
  // This is required. Replace with PRIVATE subnet ids 
  privateVpcSubnetIds: [],
  clusterNodeCount: 7,
  // The external secrets manager will be given IAM access to secrets under prefix
  secretsPrefix: "path/to/secrets", 
  clusterInstanceType: ec2.InstanceType.of(ec2.InstanceClass.R6A, ec2.InstanceSize.XLARGE), // See CDK docs for available instance sizes
  clusterName: "MyCluster",
  // This is optional but often your EKS cluster needs access to other resources such as a RDS instance
  // This takes the destination security group id and port(s) to allow access to
  networkAccessGrants: [{ targetSgId: "sg-12345", port: Port.tcp(5432) }],
});

// Add tags for your stack here. Note: there is a limitation with CDK EKS at the moment where
// the ec2 instances deployed as K8s nodes will NOT be tagged. They need to be tagged manually (annoyingly)
const tags = {
  Name: "MyCluster",
};

Object.entries(tags).forEach(([k, v]) => {
  Tags.of(app).add(k, v);
});
