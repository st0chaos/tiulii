{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "tiulii";
          version = "0.1.0";
          src = ./.;
          npmDepsHash = "sha256-7OIoxfh8Vi/zVtcwD2dZE6NaoJWkSpplM7oezKIiYqg=";
        };
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.typescript-language-server
            pkgs.prettier
            pkgs.neovim
          ];
        };
      }
    );
}
