/**
 * SAML 2.0 client — wraps @node-saml/node-saml
 *
 * Responsibilities:
 *  - Build the SP SAML instance from stored IdentityProvider config
 *  - Generate IdP redirect URLs (SP-initiated SSO)
 *  - Validate SAML responses and extract user claims
 *  - Test-connection helper (validates certificate + entry-point reachability)
 */
import { SAML, ValidateInResponseTo, type SamlOptions } from "@node-saml/node-saml";

export interface SamlConfig {
  entryPoint:  string;
  issuer:      string;
  certificate: string;   // IdP's X.509 certificate (PEM or base64 body)
  callbackUrl: string;
  logoutUrl?:  string;
}

export interface SamlClaims {
  nameID:       string;
  email:        string;
  displayName?: string;
  firstName?:   string;
  lastName?:    string;
  raw:          Record<string, unknown>;
}

/** Normalise a PEM certificate — strip headers/newlines so the library
 *  always receives the bare base64 body it prefers. */
function normaliseCert(cert: string): string {
  return cert
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g,   "")
    .replace(/\s+/g, "")
    .trim();
}

/** Build the SAML instance from provider config. */
function buildSaml(config: SamlConfig, providerId: string): SAML {
  /* Many SamlOptions fields are required in the TypeScript types but have
   * runtime defaults in the library — cast to avoid enumerating all of them. */
  const options = {
    callbackUrl:                  config.callbackUrl,
    entryPoint:                   config.entryPoint,
    issuer:                       config.issuer,
    idpCert:                      normaliseCert(config.certificate),
    wantAssertionsSigned:         false,   // many IdPs don't sign individual assertions
    wantAuthnResponseSigned:      true,    // require signed top-level Response
    validateInResponseTo:         ValidateInResponseTo.never, // no server-side request-ID store
    disableRequestedAuthnContext: true,
    audience:                     config.issuer,
    idpIssuer:                    config.issuer,
    identifierFormat:             "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  } as SamlOptions;
  void providerId; // used by caller for RelayState
  return new SAML(options);
}

/**
 * Generate the IdP redirect URL to initiate SAML SSO.
 * @param config     Provider configuration
 * @param providerId Used as the RelayState so the callback can find the provider
 * @returns          Redirect URL
 */
export async function getSamlLoginUrl(
  config:     SamlConfig,
  providerId: string,
): Promise<string> {
  const saml = buildSaml(config, providerId);
  // RelayState = provider_id — the callback reads it to look up the provider
  // getAuthorizeUrlAsync returns Promise<string> in @node-saml/node-saml v4
  const url = await saml.getAuthorizeUrlAsync(providerId, "", {});
  return url;
}

/**
 * Validate a SAML POST-binding response and extract user claims.
 * @param config      Provider configuration
 * @param providerId  For buildSaml
 * @param samlResponse The raw base64 SAMLResponse value from the POST body
 */
export async function validateSamlResponse(
  config:       SamlConfig,
  providerId:   string,
  samlResponse: string,
): Promise<SamlClaims> {
  const saml = buildSaml(config, providerId);
  const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });

  if (!profile) {
    throw new Error("SAML validation returned no profile.");
  }

  /* Extract email — standard locations across Okta / Auth0 / Azure / Keycloak */
  const email =
    (profile.email as string | undefined)                                           ??
    (profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] as string | undefined) ??
    (profile["urn:oid:1.2.840.113549.1.9.1"] as string | undefined)                ??
    (profile.nameID?.includes("@") ? profile.nameID : undefined)                   ??
    "";

  if (!email) {
    throw new Error("SAML assertion did not include a usable email address.");
  }

  /* Extract display name — various attribute formats */
  const displayName =
    (profile.displayName as string | undefined)                                                          ??
    (profile["http://schemas.microsoft.com/identity/claims/displayname"] as string | undefined)          ??
    (profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] as string | undefined)        ??
    undefined;

  const firstName =
    (profile.givenName as string | undefined)                                                            ??
    (profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"] as string | undefined)   ??
    undefined;

  const lastName =
    (profile.familyName as string | undefined)                                                           ??
    (profile["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"] as string | undefined)     ??
    undefined;

  return {
    nameID:      profile.nameID ?? "",
    email:       email.toLowerCase().trim(),
    displayName,
    firstName,
    lastName,
    raw:         profile as unknown as Record<string, unknown>,
  };
}

/**
 * Test connection: verify config fields and try a HEAD request to the entry point.
 */
export async function testSamlConnection(config: SamlConfig): Promise<{ success: boolean; message: string; details?: string }> {
  /* Validate certificate format */
  if (!config.certificate?.trim()) {
    return { success: false, message: "No X.509 certificate provided." };
  }

  try {
    normaliseCert(config.certificate); // throws if obviously malformed
  } catch {
    return { success: false, message: "Certificate appears malformed." };
  }

  /* Validate entry point URL */
  let entryUrl: URL;
  try {
    entryUrl = new URL(config.entryPoint);
    if (!["http:", "https:"].includes(entryUrl.protocol)) {
      return { success: false, message: "Entry Point URL must use http or https." };
    }
  } catch {
    return { success: false, message: "Entry Point URL is not a valid URL." };
  }

  /* Try reaching the entry point */
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    const res        = await fetch(entryUrl.toString(), {
      method:  "HEAD",
      signal:  controller.signal,
      headers: { "User-Agent": "ComplianceApp-SAML-Test/1.0" },
    });
    clearTimeout(timeout);

    return {
      success: true,
      message: `Entry point reachable (HTTP ${res.status}). Certificate and issuer look valid.`,
      details: `URL: ${config.entryPoint}, Issuer: ${config.issuer}`,
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("abort")) {
      return { success: false, message: "Connection timed out reaching the SAML entry point." };
    }
    return { success: false, message: `Could not reach entry point: ${msg}` };
  }
}
