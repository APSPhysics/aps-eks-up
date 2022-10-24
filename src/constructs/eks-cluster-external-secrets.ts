import { Construct } from "constructs";
import { Cluster, ServiceAccount } from "aws-cdk-lib/aws-eks";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3Assets from "aws-cdk-lib/aws-s3-assets";
import * as path from "path";

export type EksClusterExternalSecretsProps = {
  cluster: Cluster;
  secretsPrefix: string;
  argoGithubUrl: string;
  githubTokenSecretPath: string;
};

export class EksClusterExternalSecrets extends Construct {
  readonly serviceAccount: ServiceAccount;

  constructor(
    scope: Construct,
    id: string,
    props: EksClusterExternalSecretsProps
  ) {
    super(scope, id);
    const namespace = props.cluster.addManifest("external-secrets-namespace", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: "external-secrets" },
    });

    const serviceAccount = props.cluster.addServiceAccount(
      "ExternalSecretsServiceAccount",
      {
        namespace: "external-secrets",
        name: "external-secrets-service-account",
      }
    );

    serviceAccount.node.addDependency(namespace);

    this.serviceAccount = serviceAccount;

    const secretsAccessPolicy = new iam.Policy(this, "EKSSecretAccessPolicy", {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "secretsmanager:GetResourcePolicy",
            "secretsmanager:GetSecretValue",
            "secretsmanager:DescribeSecret",
            "secretsmanager:ListSecretVersionIds",
          ],
          resources: [
            `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${
              cdk.Stack.of(this).account
            }:secret:${props.secretsPrefix}*`,
            `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${
              cdk.Stack.of(this).account
            }:secret:${props.githubTokenSecretPath}-??????`,
          ],
        }),
      ],
    });

    serviceAccount.role.attachInlinePolicy(secretsAccessPolicy);

    const esoHelm = props.cluster.addHelmChart("ExternalSecretsOperator", {
      chart: "external-secrets",
      release: "external-secrets",
      repository: "https://charts.external-secrets.io",
      namespace: "external-secrets",
      wait: true,
      values: {
        installCRDs: true,
        webhook: {
          port: 9443,
        },
      },
    });

    const ArgoRepositoryConfigHelmChartAsset = new s3Assets.Asset(
      this,
      "ArgoRepositoryConfigHelmChartAsset",
      {
        path: path.join(
          __dirname,
          "..",
          "..",
          "helm",
          "charts",
          "argo-repository-config"
        ),
      }
    );

    props.cluster
      .addHelmChart("ArgoRepositoryConfigHelm", {
        chartAsset: ArgoRepositoryConfigHelmChartAsset,
        values: {
          argoGithubUrl: props.argoGithubUrl,
          githubTokenSecretPath: props.githubTokenSecretPath,
          awsRegion: cdk.Stack.of(this).region,
        },
      })
      .node.addDependency(esoHelm);
  }
}
