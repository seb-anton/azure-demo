import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { VirtualNetwork } from "@cdktf/provider-azurerm/lib/virtual-network";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { ContainerApp } from "@cdktf/provider-azurerm/lib/container-app";
import { ContainerAppEnvironment } from "@cdktf/provider-azurerm/lib/container-app-environment";
import { LogAnalyticsWorkspace } from "@cdktf/provider-azurerm/lib/log-analytics-workspace";
import { NetworkSecurityGroup } from "@cdktf/provider-azurerm/lib/network-security-group";
import { networkSecurityRule } from "@cdktf/provider-azurerm";
import { NetworkSecurityRule } from "@cdktf/provider-azurerm/lib/network-security-rule";
import { Subnet } from "@cdktf/provider-azurerm/lib/subnet";

class AzureDemoStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);


    const rg = new ResourceGroup(this, "DemoRG", {
      name: "DemoRG",
      location: "uksouth",
    });

    const vNet = new VirtualNetwork(this, "DemoVnet", {
      location: rg.location,
      addressSpace: ["10.0.0.0/24"],
      name: "DemoVNet",
      resourceGroupName: rg.name,     
    });

    const publicSubnet = new Subnet(this, "PublicSubnet", {
      resourceGroupName: rg.name,
      name: "PublicSubnet",
      virtualNetworkName: vNet.name,
      addressPrefixes: ["10.0.0.0/25"],
    });

    const privateSubnet = new Subnet(this, "PrivateSubnet", {
      resourceGroupName: rg.name,
      name: "PrivateSubnet",
      virtualNetworkName: vNet.name,
      addressPrefixes: ["10.0.0.128/26"],
    });

    const databaseSubnet = new Subnet(this, "DatabaseSubnet", {
      resourceGroupName: rg.name,
      name: "DatabaseSubnet",
      virtualNetworkName: vNet.name,
      addressPrefixes: ["10.0.0.192/26"],
    });

    const backendBankSg = new NetworkSecurityGroup(this, "BackendBankSecurityGroup", {
      location: rg.location,
      resourceGroupName: rg.name,
      name: "BackendBankSecurityGroup",
    });

    const backendBankSecRuleInbound = new NetworkSecurityRule(this, "BackendBankSecurityRuleInbound", {
      resourceGroupName: rg.name,
      name: "BackendBankSecurityRuleInbound",
      networkSecurityGroupName: backendBankSg.name,
      priority: 100,
      direction: "Inbound",
      access: "Allow",
      protocol: "TCP",
      sourcePortRange: "*",
      destinationPortRange: "*",
      sourceAddressPrefix: "203.0.113.0/24",
      destinationAddressPrefix: "203.0.113.0/24",
    });

    const backendBankSecRuleOutbound = new NetworkSecurityRule(this, "BackendBankSecurityRuleOutbound", {
      resourceGroupName: rg.name,
      name: "BackendBankSecurityRuleOutbound",
      networkSecurityGroupName: backendBankSg.name,
      priority: 100,
      direction: "Outbound",
      access: "Allow",
      protocol: "TCP",
      sourcePortRange: "*",
      destinationPortRange: "*",
      sourceAddressPrefix: "203.0.113.0/24",
      destinationAddressPrefix: "203.0.113.0/24",
    });




    const logAnalyticsWS = new LogAnalyticsWorkspace(this, "DemoLogAnalyticsWorkspace", {
      location: rg.location,
      resourceGroupName: rg.name,
      name: "DemoLogAnalyticsWorkspace",
    });

    const containerAppEnvPublic = new ContainerAppEnvironment(this, "DemoContainerAppEnvPublic", {
      location: rg.location,
      name: "DemoContainerAppEnvPublic",
      resourceGroupName: rg.name,
      logAnalyticsWorkspaceId: logAnalyticsWS.id,
      infrastructureSubnetId: vNet.subnet.get(0).id, 
    });

    const containerAppEnvPrivate = new ContainerAppEnvironment(this, "DemoContainerAppEnvPrivate", {
      location: rg.location,
      name: "DemoContainerAppEnvPrivate",
      resourceGroupName: rg.name,
      logAnalyticsWorkspaceId: logAnalyticsWS.id,
      infrastructureSubnetId: vNet.subnet.get(1).id,      
    });

    const backendBankWrapper = new ContainerApp(this, "DemoBackendBankWrapper", {
      resourceGroupName: rg.name,
      containerAppEnvironmentId: containerAppEnvPrivate.id,
      name: "backendBankWrapper",
      revisionMode: "Single",
      template: {
        container:[{
          name: "DemoBackendBankWrapper",
          image: "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest",
          cpu: 0.25,
          memory: "0.5Gi"
        }],
      }
    });

    const backendForReact = new ContainerApp(this, "DemoBackendForReact", {
      resourceGroupName: rg.name,
      containerAppEnvironmentId: containerAppEnvPublic.id,
      name: "backendForReact",
      revisionMode: "Single",
      template: {
        container:[{
          name: "DemoBackendForReact",
          image: "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest",
          cpu: 0.25,
          memory: "0.5Gi"
        }],
      }
    });

  }
}

const app = new App();
new AzureDemoStack(app, "azure-demo");
app.synth();
