import { Construct } from "constructs";
import * as eks from "aws-cdk-lib/aws-eks";
import * as s3Assets from "aws-cdk-lib/aws-s3-assets";

import * as path from "path";

export type EksClusterArgoProps = {
  cluster: eks.Cluster;
};

export class EksClusterArgo extends Construct {
  constructor(scope: Construct, id: string, props: EksClusterArgoProps) {
    super(scope, id);

    const namespace = props.cluster.addManifest("ArgoCDNamespaces", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: "argocd" },
    });

    const argoCdHelmChartAsset = new s3Assets.Asset(this, "ArgoCdHelmChart", {
      path: path.join(__dirname, "..", "..", "helm", "charts", "argo-cd"),
    });

    props.cluster.addHelmChart("ArgoCdHelm", {
      chartAsset: argoCdHelmChartAsset,
      namespace: "argocd",
      createNamespace: true,
    });
  }
}
