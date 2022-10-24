import * as eks from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { KubectlV24Layer } from "@aws-cdk/lambda-layer-kubectl-v24";
import { EksNetworkAccessGrant } from "../eks-cluster-stack";
import { Tags } from "aws-cdk-lib";

export type EksClusterProps = {
  vpc: ec2.IVpc;
  privateVpcSubnetIds: string[];
  clusterName: string;
  clusterNodeCount: number;
  clusterInstanceType: ec2.InstanceType;
  networkAccessGrants: EksNetworkAccessGrant[];
};

export class EksCluster extends Construct {
  public readonly cluster: eks.Cluster;

  constructor(scope: Construct, id: string, props: EksClusterProps) {
    super(scope, id);

    const privateVpcSubnetFilter = ec2.SubnetFilter.byIds(
      props.privateVpcSubnetIds
    );

    const eksCluster = new eks.Cluster(this, "EksCluster", {
      version: eks.KubernetesVersion.of("1.24"),
      kubectlLayer: new KubectlV24Layer(this, "kubectl"),
      clusterName: props.clusterName,
      vpcSubnets: [{ subnetFilters: [privateVpcSubnetFilter] }],
      vpc: props.vpc,
      albController: {
        version: eks.AlbControllerVersion.V2_4_1,
      },
      defaultCapacity: 0,
    });

    props.privateVpcSubnetIds.forEach((subnetId, i) => {
      const subnet = ec2.Subnet.fromSubnetId(this, `SubnetToTag${i}`, subnetId);
      Tags.of(subnet).add("kubernetes.io/role/internal-elb", "1");
    });

    const allowControlPlaneSsl = new ec2.SecurityGroup(
      this,
      "allowControlPlaneSsl",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: "Allows access to EKS control plane on 443",
      }
    );

    const vpnIpv4Space = ec2.Peer.ipv4("10.11.112.19/32");
    allowControlPlaneSsl.addIngressRule(
      vpnIpv4Space,
      ec2.Port.tcp(443),
      "Allow access from VPN"
    );

    eksCluster.connections.addSecurityGroup(allowControlPlaneSsl);

    props.networkAccessGrants.forEach((nag, i) =>
      ec2.SecurityGroup.fromSecurityGroupId(
        this,
        `ClusterNetworkAccessGrant${i}`,
        nag.targetSgId
      ).addIngressRule(
        eksCluster.clusterSecurityGroup,
        nag.port,
        `K8s Cluster ${eksCluster.clusterName}`
      )
    );

    new eks.Nodegroup(this, "EksNodegroup", {
      cluster: eksCluster,
      instanceTypes: [
        props.clusterInstanceType,
      ],
      desiredSize: props.clusterNodeCount,
      diskSize: 100,
      subnets: {
        onePerAz: true,
        subnetFilters: [privateVpcSubnetFilter],
      },
    });

    this.cluster = eksCluster;
  }
}
