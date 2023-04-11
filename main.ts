import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { VirtualNetwork } from "@cdktf/provider-azurerm/lib/virtual-network";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { ContainerApp } from "@cdktf/provider-azurerm/lib/container-app";
import { ContainerAppEnvironment } from "@cdktf/provider-azurerm/lib/container-app-environment";
import { LogAnalyticsWorkspace } from "@cdktf/provider-azurerm/lib/log-analytics-workspace";

class AzureDemoStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const defaultLocation = "uksouth"

    const rg = new ResourceGroup(this, "DemoRG", {
      name: "DemoRG",
      location: defaultLocation,
    });

    const vNet = new VirtualNetwork(this, "DemoVnet", {
      location: defaultLocation,
      addressSpace: ["10.0.0.0/24"],
      name: "DemoVNet",
      resourceGroupName: rg.name,
    });

    const logAnalyticsWS = new LogAnalyticsWorkspace(this, "DemoLogAnalyticsWorkspace", {
      location: defaultLocation,
      resourceGroupName: rg.name,
      name: "DemoLogAnalyticsWorkspace",
    })

    const containerAppEnv = new ContainerAppEnvironment(this, "ContainerAppEnv", {
      location: defaultLocation,
      name: "DemoContainerAppEnv",
      resourceGroupName: rg.name,
      logAnalyticsWorkspaceId: logAnalyticsWS.id,
    })

    const backendBankWrapper = new ContainerApp(this, "DemoBackendBankWrapper", {
      resourceGroupName: demoRg.name,
      containerAppEnvironmentId: "dev",
      name: "backendBankWrapper",
      revisionMode: "Single",
      template: {
        container:[{
          name: "DemoBackendBankWrapper",
      image: "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest",
    }],
      }


    })

  }
}

const app = new App();
new AzureDemoStack(app, "azure-demo");
app.synth();
