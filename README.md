# APS EKS UP

## Description
A CDK stack and associated resources to deploy a fully functional EKS cluster ready for use by ArgoCD

## Deployment
* `npm i`
* Enter credentials for your account
* `npx cdk deploy`

## Structure
After this stack is run, a EKS cluster is provisioned with the following things done:
* external-secrets operator is installed with a service account that can access AWS secrets and make them into K8s secrets for application use. This has access under the secret key prefix you configure.  
* AWS loadbalancer ingress controller with IAM permissions to spawn ALBs
* ArgoCD
* ArgoCD then is given credentials using the secrets operator to connect to the argo application repository for deploys
* If your argoCD applications repo is populated, it will deploy all of your apps. So full cluster with apps on one `cdk deploy`. No manual steps. This presumes you have your argo applications in `argocd/apps` directory. This creates a root "app of apps" to automatically deploy anything under that.


## Prerequisites and Configuration
* In the `bin/cdk.ts` file there are variables to be populated. For the ones that are not self explanitory:
    * `secretsPrefix` The pattern here is to namespace your secrets with a unique string to your cluster so you can access them via the External Secrets Operator. So for instance prod/myEksCluster/* would give your ESO service account the ability to read those secrets and by extension, applications the ability to incorporate them in their helm chart secrets.
   * `networkAccessGrants` It is common that your cluster needs network access to something like RDS or EFS. This takes `targetSgId` which is the id such as `sg-12343534` of the resource security group you want to connect to, and port which is an ec2 `Port`. It then will add to that security group an incoming rule on that port(s) from the cluster security group.
* You must have a github token for your argocd target repo in AWS secret manager. This is configurable in `githubTokenSecretPath` The bootstrap will grant access to this secret to the secrets operator to then forward to ArgoCD for connecting to github.
* You need at least 3 private subnets to assign to the cluster designated by the `privateVpcSubnetIds` attribute. They must be tagged with `kubernetes.io/role/internal-elb=1` You also need these subnets to be tagged `kubernetes.io/cluster/YOUR_CLUSTER_NAME=shared` If we were making our subnets with this stack it would be possible but CDK can NOT currently tag existing subnets.

## Post install
### Kubectl setup
After this stack runs, one of the outputs will be an aws eks command to import this cluster auth into your `.kube/config` file as a context. You can verify this worked by `kubectl get nodes`

### Internet facing ALBs
* To expose ALB ingresses to the internet, you need to tag **public** VPC subnets with `kubernetes.io/role/elb=1` and put the annotation in the ingress deploy to k8s: `alb.ingress.kubernetes.io/subnets: subnet-123453223,subnet-342343244` Substitute your subnet IDs. You also need at least 1 subnet in the same availability zone as each of the private subnets otherwise some pods will not be able to be targeted by the ALB.

### ArgoCD web console access
The admin password is randomly generated and lives in a k8s secret in the argocd namespace..
The console for argocd is running in k8s but not exposed so you have to expose it with port forwarding.
1. Get the service name with `kubectl get services -n argocd` it is the one that ends with `-server`
1. Insert this service in this line `kubectl port-forward service/reksclusterstacktesseracteksv3chartargocdhelma8ef5505-server 8080:80 -n argocd` and run it. Your name will probably be different
1. Get the admin password for argo `kubectl get secret argocd-initial-admin-secret -n argocd -o json | jq -r .data.password | base64 -d`
1. Go to http://localhost:8080 and enter `admin` as the username, and the password you got in the previous step.

### External Secrets Operator usage
See [the docs](https://external-secrets.io/v0.6.1/) for details. This CDK stack creates a [ClusterSecretStore](https://external-secrets.io/v0.6.1/api/clustersecretstore/) that uses a provisioned service account to access your secrets at the prefix you defined (and your github token). The ClusterSecretStore name is `aws-secret-store`. [This](./helm/charts/argo-repository-config/templates/secrets.yaml) is an example. It creates a secret and then merges in a secret from the store. You don't have to do it this way, you can make all secrets come from the store by setting the `creationPolicy` to `Owner` [This page](https://external-secrets.io/v0.6.1/api/externalsecret/) has a kitchen sink example of the config. Much more information is available in the project docs.
