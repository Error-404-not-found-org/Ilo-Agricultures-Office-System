import dns from "node:dns";

export const CUSTOM_DNS_SERVERS = Object.freeze(["1.1.1.1", "8.8.8.8"]);

export const configureCustomDns = ({
  forceCustomDns = process.env.FORCE_CUSTOM_DNS,
  environment = process.env.NODE_ENV,
  dnsModule = dns,
  logger = console,
} = {}) => {
  const requested = String(forceCustomDns || "").toLowerCase() === "true";
  const production = String(environment || "").toLowerCase() === "production";
  if (!requested || production) {
    return { enabled: false, servers: dnsModule.getServers() };
  }

  dnsModule.setServers([...CUSTOM_DNS_SERVERS]);
  const servers = dnsModule.getServers();
  logger.warn(`[DNS] Effective DNS servers: ${servers.join(", ")}`);
  return { enabled: true, servers };
};
