import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { VirtualNetwork } from "@cdktf/provider-azurerm/lib/virtual-network";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { ContainerApp } from "@cdktf/provider-azurerm/lib/container-app";
import { ContainerAppEnvironment } from "@cdktf/provider-azurerm/lib/container-app-environment";
import { LogAnalyticsWorkspace } from "@cdktf/provider-azurerm/lib/log-analytics-workspace";
import { NetworkSecurityGroup } from "@cdktf/provider-azurerm/lib/network-security-group";
import { NetworkSecurityRule } from "@cdktf/provider-azurerm/lib/network-security-rule";
import { Subnet } from "@cdktf/provider-azurerm/lib/subnet";
import { SqlManagedDatabase } from "@cdktf/provider-azurerm/lib/sql-managed-database";
import { SqlManagedInstance } from "@cdktf/provider-azurerm/lib/sql-managed-instance";
import { ApiManagement } from "@cdktf/provider-azurerm/lib/api-management";
import { ApiManagementApi } from "@cdktf/provider-azurerm/lib/api-management-api";
import { AppService } from "@cdktf/provider-azurerm/lib/app-service";
import { AppServicePlan } from "@cdktf/provider-azurerm/lib/app-service-plan";
import { LinuxFunctionApp } from "@cdktf/provider-azurerm/lib/linux-function-app";
import { ServicePlan } from "@cdktf/provider-azurerm/lib/service-plan";
import { LinuxWebApp } from "@cdktf/provider-azurerm/lib/linux-web-app";
import { AppServiceSourceControlA, AppServiceSourceControlGithubActionConfigurationCodeConfigurationOutputReference } from "@cdktf/provider-azurerm/lib/app-service-source-control";
import { appServiceSourceControl } from "@cdktf/provider-azurerm";


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
      infrastructureSubnetId: publicSubnet.id, 
    });

    const containerAppEnvPrivate = new ContainerAppEnvironment(this, "DemoContainerAppEnvPrivate", {
      location: rg.location,
      name: "DemoContainerAppEnvPrivate",
      resourceGroupName: rg.name,
      logAnalyticsWorkspaceId: logAnalyticsWS.id,
      infrastructureSubnetId: privateSubnet.id,      
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
      },
      ingress:{
        targetPort: 7433,
        trafficWeight:[{
          percentage: 100
        }]        
      },
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
      },
      ingress:{
        externalEnabled: true,
        targetPort: 8433,
        trafficWeight:[{
          percentage: 100
        }]        
      },
    });

    const apiManagementInternal = new ApiManagement(this, "ApiManagementInternal", {
      location: rg.location,
      name: "ApiManagementInternal",
      publisherEmail: "sebastian.anton@live.de",
      publisherName: "Sebastian",
      resourceGroupName: rg.name,
      skuName: "Developer_1",
      publicNetworkAccessEnabled: false,
      virtualNetworkType: "Internal",
      virtualNetworkConfiguration: {
        subnetId: privateSubnet.id
      }
    });

    const apiManagementExternal = new ApiManagement(this, "ApiManagementExternal", {
      location: rg.location,
      name: "ApiManagementExternal",
      publisherEmail: "sebastian.anton@live.de",
      publisherName: "Sebastian",
      resourceGroupName: rg.name,
      skuName: "Developer_1",
      publicNetworkAccessEnabled: true,
    });

    const internalApi = new ApiManagementApi(this, "InternalApi", {
      resourceGroupName: rg.name,
      name: "InternalApi",
      apiManagementName: apiManagementInternal.name,
      revision: "1",
      serviceUrl: backendBankWrapper.ingress.fqdn,
    });

    const externalApi = new ApiManagementApi(this, "ExternalApi", {
      resourceGroupName: rg.name,
      name: "ExternalApi",
      apiManagementName: apiManagementExternal.name,
      revision: "1",
      serviceUrl: backendForReact.ingress.fqdn,
    });

    const backendDatabaseInstance = new SqlManagedInstance(this, "BackendDatabaseInstance", {
      location: rg.location,
      resourceGroupName: rg.name,
      name: "BackendDatabaseInstance",
      administratorLogin: "admin",
      administratorLoginPassword: "ThisShouldNotBeHere!",
      licenseType: "BasePrice",
      skuName: "GP_Gen5",
      storageSizeInGb: 20,
      subnetId: databaseSubnet.id,
      vcores: 1,
    });

    const backendBankDatabase = new SqlManagedDatabase(this, "BackendBankDatabase", {
      location: rg.location,
      name: "BackendBankDatabase",
      sqlManagedInstanceId: backendDatabaseInstance.id,    
    });

    const backendForReactDatabase = new SqlManagedDatabase(this, "BackendForReactDatabase", {
      location: rg.location,
      name: "BackendForReactDatabase",
      sqlManagedInstanceId: backendDatabaseInstance.id,    
    });

    const servicePlan = new ServicePlan(this, "ServicePlan", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "ServicePlan",
      osType: "Linux",
      skuName: "P1v2",
    })

    const reactApp = new LinuxWebApp(this, "ReactApp", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "ReactApp",
      appSettings: {
        "WEBSITE_RUN_FROM_PACKAGE":"1"
      },
      zipDeployFile: "./react/counter-app.zip",
      servicePlanId: servicePlan.id,
      siteConfig:{
        applicationStack:{
          nodeVersion: "18-lts",
        },
      },
    });
  }
}

const app = new App();
new AzureDemoStack(app, "azure-demo");
app.synth();
