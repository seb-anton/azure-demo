import { Construct } from "constructs";
import { VirtualNetwork } from "@cdktf/provider-azurerm/lib/virtual-network";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { Subnet } from "@cdktf/provider-azurerm/lib/subnet";

export class NetworkSetup extends Construct {
  public readonly vNet: VirtualNetwork;
  public readonly publicSubnet: Subnet;
  public readonly privateSubnet: Subnet;
  public readonly databaseSubnet: Subnet;

  constructor(scope: Construct, name: string, rg: ResourceGroup) {
    super(scope, name);

    this.vNet = new VirtualNetwork(this, "Vnet", {
      resourceGroupName: rg.name,
      location: rg.location,
      name: "VNet",
      addressSpace: ["10.0.0.0/24"],
    });

    this.publicSubnet = new Subnet(this, "PublicSubnet", {
      resourceGroupName: rg.name,
      name: "PublicSubnet",
      virtualNetworkName: this.vNet.name,
      addressPrefixes: ["10.0.0.0/25"],
    });

    this.privateSubnet = new Subnet(this, "PrivateSubnet", {
      resourceGroupName: rg.name,
      name: "PrivateSubnet",
      virtualNetworkName: this.vNet.name,
      addressPrefixes: ["10.0.0.128/26"],
    });

    this.databaseSubnet = new Subnet(this, "DatabaseSubnet", {
      resourceGroupName: rg.name,
      name: "DatabaseSubnet",
      virtualNetworkName: this.vNet.name,
      addressPrefixes: ["10.0.0.192/26"],
    });
  }
}
