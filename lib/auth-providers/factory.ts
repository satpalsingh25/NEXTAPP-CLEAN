import { AuthProviderType } from "@prisma/client";
import type { IdentityAuthProvider } from "./types";
import { LocalAuthProvider }         from "./providers/local";
import { AzureAdProvider }           from "./providers/azure-ad";
import { GoogleWorkspaceProvider }   from "./providers/google-workspace";
import { LdapProvider }              from "./providers/ldap";
import { SamlProvider }              from "./providers/saml";
import { OidcProvider }              from "./providers/oidc";

export function getAuthProvider(type: AuthProviderType): IdentityAuthProvider {
  switch (type) {
    case AuthProviderType.LOCAL:            return new LocalAuthProvider();
    case AuthProviderType.AZURE_AD:        return new AzureAdProvider();
    case AuthProviderType.GOOGLE_WORKSPACE: return new GoogleWorkspaceProvider();
    case AuthProviderType.LDAP:            return new LdapProvider();
    case AuthProviderType.SAML:            return new SamlProvider();
    case AuthProviderType.OIDC:            return new OidcProvider();
    default:
      throw new Error(`Unknown auth provider type: ${type}`);
  }
}
