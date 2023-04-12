import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { ContainerApp } from "@cdktf/provider-azurerm/lib/container-app";
import { ContainerAppEnvironment } from "@cdktf/provider-azurerm/lib/container-app-environment";
import { LogAnalyticsWorkspace } from "@cdktf/provider-azurerm/lib/log-analytics-workspace";
import { NetworkSecurityGroup } from "@cdktf/provider-azurerm/lib/network-security-group";
import { NetworkSecurityRule } from "@cdktf/provider-azurerm/lib/network-security-rule";
import { SqlManagedDatabase } from "@cdktf/provider-azurerm/lib/sql-managed-database";
import { SqlManagedInstance } from "@cdktf/provider-azurerm/lib/sql-managed-instance";
import { ApiManagement } from "@cdktf/provider-azurerm/lib/api-management";
import { ApiManagementApi } from "@cdktf/provider-azurerm/lib/api-management-api";
import { ServicePlan } from "@cdktf/provider-azurerm/lib/service-plan";
import { LinuxWebApp } from "@cdktf/provider-azurerm/lib/linux-web-app";
import { ApiManagementApiOperationPolicy } from "@cdktf/provider-azurerm/lib/api-management-api-operation-policy";
import { ApiManagementApiOperation } from "@cdktf/provider-azurerm/lib/api-management-api-operation";
import { NetworkSetup } from "./network";
import { AzurermProvider } from "@cdktf/provider-azurerm/lib/provider";

export class AzureDemoStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new AzurermProvider(this, "azureProvider", {
      features: {},
    });

    const rg = new ResourceGroup(this, "DemoRG", {
      location: "uksouth",
      name: "demo_rg",
    });

    // Networking

    const network = new NetworkSetup(this, "Network", rg);

    // Security groups

    const backendBankSg = new NetworkSecurityGroup(
      this,
      "BackendBankSecurityGroup",
      {
        resourceGroupName: rg.name,
        location: rg.location,
        name: "backend_bank_security_group",
      }
    );

    new NetworkSecurityRule(this, "BackendBankSecurityRuleInbound", {
      resourceGroupName: rg.name,
      name: "backend_bank_security_rule_inbound",
      networkSecurityGroupName: backendBankSg.name,
      priority: 100,
      direction: "Inbound",
      access: "Allow",
      protocol: "Tcp",
      sourcePortRange: "*",
      destinationPortRange: "*",
      sourceAddressPrefix: "203.0.113.0/24",
      destinationAddressPrefix: "203.0.113.0/24",
    });

    new NetworkSecurityRule(this, "BackendBankSecurityRuleOutbound", {
      resourceGroupName: rg.name,
      name: "backend_bank_security_rule_outbound",
      networkSecurityGroupName: backendBankSg.name,
      priority: 100,
      direction: "Outbound",
      access: "Allow",
      protocol: "Tcp",
      sourcePortRange: "*",
      destinationPortRange: "*",
      sourceAddressPrefix: "203.0.113.0/24",
      destinationAddressPrefix: "203.0.113.0/24",
    });

    // TODO: add groups/rules for access to the public subnet and the DB subnet

    // Logging

    const logAnalyticsWS = new LogAnalyticsWorkspace(
      this,
      "LogAnalyticsWorkspace",
      {
        resourceGroupName: rg.name,
        location: rg.location,
        name: "log-analytics-workspace",
      }
    );

    // Backend Container Apps

    const containerAppEnvPublic = new ContainerAppEnvironment(
      this,
      "ContainerAppEnvPublic",
      {
        resourceGroupName: rg.name,
        location: rg.location,
        name: "container-app-env-public",
        logAnalyticsWorkspaceId: logAnalyticsWS.id,
        infrastructureSubnetId: network.publicSubnet.id,
      }
    );

    const containerAppEnvPrivate = new ContainerAppEnvironment(
      this,
      "ContainerAppEnvPrivate",
      {
        resourceGroupName: rg.name,
        location: rg.location,
        name: "container-app-env-private",
        logAnalyticsWorkspaceId: logAnalyticsWS.id,
        infrastructureSubnetId: network.privateSubnet.id,
      }
    );

    const backendBankWrapper = new ContainerApp(this, "BackendBankWrapperApp", {
      resourceGroupName: rg.name,
      name: "backend-bank-wrapper-app",
      containerAppEnvironmentId: containerAppEnvPrivate.id,
      revisionMode: "Single",
      template: {
        container: [
          {
            name: "backend-bank-wrapper-container",
            image:
              "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest",
            cpu: 0.25,
            memory: "0.5Gi",
          },
        ],
      },
      ingress: {
        externalEnabled: false,
        targetPort: 7433,
        trafficWeight: [
          {
            percentage: 100,
          },
        ],
      },
    });

    const backendForReact = new ContainerApp(this, "BackendForReactApp", {
      resourceGroupName: rg.name,
      name: "backend-for-react-app",
      containerAppEnvironmentId: containerAppEnvPublic.id,
      revisionMode: "Single",
      template: {
        container: [
          {
            name: "backend-for-react-container",
            image:
              "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest",
            cpu: 0.25,
            memory: "0.5Gi",
          },
        ],
      },
      ingress: {
        externalEnabled: true,
        targetPort: 8433,
        trafficWeight: [
          {
            percentage: 100,
          },
        ],
      },
    });

    // API Configuration

    const apiManagementInternal = new ApiManagement(
      this,
      "ApiManagementInternal",
      {
        resourceGroupName: rg.name,
        location: rg.location,
        name: "api-management-internal",
        publisherEmail: "sebastian.anton@live.de",
        publisherName: "Sebastian",
        skuName: "Developer_1",
        // publicNetworkAccessEnabled: false,
        virtualNetworkType: "Internal",
        virtualNetworkConfiguration: {
          subnetId: network.privateSubnet.id,
        },
      }
    );

    const apiManagementExternal = new ApiManagement(
      this,
      "ApiManagementExternal",
      {
        resourceGroupName: rg.name,
        location: rg.location,
        name: "api-management-external",
        publisherEmail: "sebastian.anton@live.de",
        publisherName: "Sebastian",
        skuName: "Developer_1",
        publicNetworkAccessEnabled: true,
      }
    );

    new ApiManagementApi(this, "InternalApi", {
      resourceGroupName: rg.name,
      name: "internal_api",
      apiManagementName: apiManagementInternal.name,
      revision: "1",
      serviceUrl: backendBankWrapper.ingress.fqdn,
    });

    const externalApi = new ApiManagementApi(this, "ExternalApi", {
      resourceGroupName: rg.name,
      name: "external_api",
      apiManagementName: apiManagementExternal.name,
      revision: "1",
      serviceUrl: backendForReact.ingress.fqdn,
    });

    const apiOperationExternal = new ApiManagementApiOperation(
      this,
      "ApiOperationExternal",
      {
        resourceGroupName: rg.name,
        apiManagementName: apiManagementExternal.name,
        apiName: externalApi.name,
        displayName: "GET",
        method: "GET",
        operationId: "demo-get",
        urlTemplate: "/",
      }
    );

    new ApiManagementApiOperationPolicy(this, "RateLimit", {
      resourceGroupName: rg.name,
      apiManagementName: apiManagementExternal.name,
      apiName: externalApi.name,
      operationId: apiOperationExternal.id,
      xmlContent: '<rate-limit calls="10" renewal-period="1"></rate-limit>',
    });

    // TODO finish API configuration for all methods and add API operation for the webhook implementation

    // Databases

    const backendDatabaseInstance = new SqlManagedInstance(
      this,
      "BackendDatabaseInstance",
      {
        resourceGroupName: rg.name,
        location: rg.location,
        name: "backend-database-instance",
        administratorLogin: "Masteruser",
        administratorLoginPassword: "ThisShouldNotBeHere!", // TODO put this in a secret store and retrieve it from there
        licenseType: "BasePrice",
        skuName: "GP_Gen5",
        storageSizeInGb: 32,
        subnetId: network.databaseSubnet.id,
        vcores: 4,
      }
    );

    new SqlManagedDatabase(this, "BackendBankDatabase", {
      location: rg.location,
      name: "backend_bank_database",
      sqlManagedInstanceId: backendDatabaseInstance.id,
    });

    new SqlManagedDatabase(this, "BackendForReactDatabase", {
      location: rg.location,
      name: "backend_for_react_database",
      sqlManagedInstanceId: backendDatabaseInstance.id,
    });

    // React Web App

    const servicePlan = new ServicePlan(this, "ServicePlan", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "service_plan",
      osType: "Linux",
      skuName: "P1v2",
    });

    new LinuxWebApp(this, "ReactApp", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "azure-demo-react-app-santon",
      appSettings: {
        WEBSITE_RUN_FROM_PACKAGE: "1",
      },
      zipDeployFile: "./react/counter-app.zip",
      servicePlanId: servicePlan.id,
      siteConfig: {
        applicationStack: {
          nodeVersion: "18-lts",
        },
      },
    });
  }
}

const app = new App();
new AzureDemoStack(app, "azure-demo");
app.synth();
