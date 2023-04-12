import "cdktf/lib/testing/adapters/jest"; // Load types for expect matchers
import { Testing } from "cdktf";
import { NetworkSetup } from "../network";
import { ResourceGroup } from "@cdktf/provider-azurerm/lib/resource-group";
import { Subnet } from "@cdktf/provider-azurerm/lib/subnet";

describe("Unit testing using assertions", () => {
  it("should contain a subnet", () => {
    expect(
      Testing.synthScope((scope) => {
        new NetworkSetup(
          scope,
          "network-class-under-test",
          new ResourceGroup(scope, "accpt", {
            location: "mock-loc",
            name: "mock-name",
          })
        );
      })
    ).toHaveResource(Subnet);
  });

  it("should contain a subnet with the name private_subnet", () => {
    expect(
      Testing.synthScope((scope) => {
        new NetworkSetup(
          scope,
          "network-class-under-test",
          new ResourceGroup(scope, "accpt", {
            location: "mock-loc",
            name: "mock-name",
          })
        );
      })
    ).toHaveResourceWithProperties(Subnet, { name: "private_subnet" });
  });
});
