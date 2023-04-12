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
      name: "vnet",
      addressSpace: ["10.0.0.0/16"],
    });

    this.publicSubnet = new Subnet(this, "PublicSubnet", {
      resourceGroupName: rg.name,
      name: "public_subnet",
      virtualNetworkName: this.vNet.name,
      addressPrefixes: ["10.0.0.0/17"],
    });

    this.privateSubnet = new Subnet(this, "PrivateSubnet", {
      resourceGroupName: rg.name,
      name: "private_subnet",
      virtualNetworkName: this.vNet.name,
      addressPrefixes: ["10.0.128.0/18"],
    });

    this.databaseSubnet = new Subnet(this, "DatabaseSubnet", {
      resourceGroupName: rg.name,
      name: "database_subnet",
      virtualNetworkName: this.vNet.name,
      addressPrefixes: ["10.0.192.0/18"],
    });
  }
}
