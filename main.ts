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
import { ServicePlan } from "@cdktf/provider-azurerm/lib/service-plan";
import { LinuxWebApp } from "@cdktf/provider-azurerm/lib/linux-web-app";
import { ApiManagementApiOperationPolicy } from "@cdktf/provider-azurerm/lib/api-management-api-operation-policy";
import { ApiManagementApiOperation } from "@cdktf/provider-azurerm/lib/api-management-api-operation";

class AzureDemoStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);


    const rg = new ResourceGroup(this, "DemoRG", {
      location: "uksouth",
      name: "DemoRG",
    });

    const vNet = new VirtualNetwork(this, "Vnet", {
      resourceGroupName: rg.name,     
      location: rg.location,
      name: "VNet",
      addressSpace: ["10.0.0.0/24"],
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
      resourceGroupName: rg.name,
      location: rg.location,
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

    



    const logAnalyticsWS = new LogAnalyticsWorkspace(this, "LogAnalyticsWorkspace", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "LogAnalyticsWorkspace",
    });

    const containerAppEnvPublic = new ContainerAppEnvironment(this, "ContainerAppEnvPublic", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "ContainerAppEnvPublic",
      logAnalyticsWorkspaceId: logAnalyticsWS.id,
      infrastructureSubnetId: publicSubnet.id, 
    });

    const containerAppEnvPrivate = new ContainerAppEnvironment(this, "ContainerAppEnvPrivate", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "ContainerAppEnvPrivate",
      logAnalyticsWorkspaceId: logAnalyticsWS.id,
      infrastructureSubnetId: privateSubnet.id,      
    });



    const backendBankWrapper = new ContainerApp(this, "BackendBankWrapperApp", {
      resourceGroupName: rg.name,
      name: "BackendBankWrapperApp",
      containerAppEnvironmentId: containerAppEnvPrivate.id,
      revisionMode: "Single",
      template: {
        container:[{
          name: "BackendBankWrapperContainer",
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

    const backendForReact = new ContainerApp(this, "BackendForReactApp", {
      resourceGroupName: rg.name,
      name: "BackendForReactApp",
      containerAppEnvironmentId: containerAppEnvPublic.id,
      revisionMode: "Single",
      template: {
        container:[{
          name: "BackendForReactContainer",
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
      resourceGroupName: rg.name,
      location: rg.location,
      name: "ApiManagementInternal",
      publisherEmail: "sebastian.anton@live.de",
      publisherName: "Sebastian",
      skuName: "Developer_1",
      publicNetworkAccessEnabled: false,
      virtualNetworkType: "Internal",
      virtualNetworkConfiguration: {
        subnetId: privateSubnet.id
      }
    });

    const apiManagementExternal = new ApiManagement(this, "ApiManagementExternal", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "ApiManagementExternal",
      publisherEmail: "sebastian.anton@live.de",
      publisherName: "Sebastian",
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

    const apiOperationExternal = new ApiManagementApiOperation(this, "ApiOperationExternal", {
      resourceGroupName: rg.name,
      apiManagementName: apiManagementExternal.name,
      apiName: externalApi.name,
      displayName: "GET",
      method: "GET",
      operationId: "demo-get",
      urlTemplate: "/"
    });

    new ApiManagementApiOperationPolicy(this, "RateLimit", {
      resourceGroupName: rg.name,
      apiManagementName: apiManagementExternal.name,
      apiName: externalApi.name,
      operationId: apiOperationExternal.id,
      xmlContent: '<rate-limit calls="10" renewal-period="1"></rate-limit>'
    });

    const backendDatabaseInstance = new SqlManagedInstance(this, "BackendDatabaseInstance", {
      resourceGroupName: rg.name,
      location: rg.location,
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
