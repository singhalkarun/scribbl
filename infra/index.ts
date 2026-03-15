import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as containerregistry from "@pulumi/azure-native/containerregistry";
import * as operationalinsights from "@pulumi/azure-native/operationalinsights";
import * as cache from "@pulumi/azure-native/cache";
import * as app from "@pulumi/azure-native/app";

const config = new pulumi.Config();
const stack = pulumi.getStack();
const location = config.get("location") || "centralindia";
const secretKeyBase = config.requireSecret("secretKeyBase");
const backendMaxReplicas = config.getNumber("backendMaxReplicas") || 4;

// Domain configuration
const domain = config.get("domain") || "scribbl.singhalkarun.com";
const apiDomain = `api.${domain}`;

// Set to true after DNS records are created (Phase 2)
const enableCustomDomain = config.getBoolean("enableCustomDomain") || false;

// ── Resource Group ─────────────────────────────────────────────────────────────

const resourceGroup = new resources.ResourceGroup("rg", {
    resourceGroupName: `scribbl-${stack}-rg`,
    location,
});

// ── Azure Container Registry ───────────────────────────────────────────────────

const registry = new containerregistry.Registry("acr", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    registryName: `scribbl${stack}acr`.replace(/-/g, ""),
    sku: { name: containerregistry.SkuName.Basic },
    adminUserEnabled: true,
    dataEndpointEnabled: false,
    encryption: { status: containerregistry.EncryptionStatus.Disabled },
    policies: {
        exportPolicy: { status: containerregistry.ExportPolicyStatus.Enabled },
        quarantinePolicy: { status: containerregistry.PolicyStatus.Disabled },
        retentionPolicy: { days: 7, status: containerregistry.PolicyStatus.Disabled },
        trustPolicy: { status: containerregistry.PolicyStatus.Disabled, type: containerregistry.TrustPolicyType.Notary },
    },
});

const registryCredentials = pulumi
    .all([resourceGroup.name, registry.name])
    .apply(([rgName, registryName]) =>
        containerregistry.listRegistryCredentials({ resourceGroupName: rgName, registryName }),
    );

const acrUsername = registryCredentials.apply((c) => c.username!);
const acrPassword = registryCredentials.apply((c) => c.passwords![0].value!);

// ── Log Analytics Workspace (required for Container Apps) ──────────────────────

const logAnalytics = new operationalinsights.Workspace("logs", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    workspaceName: `scribbl-${stack}-logs`,
    sku: { name: operationalinsights.WorkspaceSkuNameEnum.PerGB2018 },
    retentionInDays: 30,
    features: { enableLogAccessUsingOnlyResourcePermissions: true },
    publicNetworkAccessForIngestion: operationalinsights.PublicNetworkAccessType.Enabled,
    publicNetworkAccessForQuery: operationalinsights.PublicNetworkAccessType.Enabled,
    workspaceCapping: { dailyQuotaGb: -1 },
});

const logAnalyticsSharedKey = pulumi
    .all([resourceGroup.name, logAnalytics.name])
    .apply(([rgName, workspaceName]) =>
        operationalinsights.getSharedKeys({ resourceGroupName: rgName, workspaceName }),
    )
    .apply((keys) => keys.primarySharedKey!);

// ── Azure Cache for Redis ──────────────────────────────────────────────────────
//
// After deployment, enable keyspace notifications required by TimeoutWatcher:
//   az redis update --name <redis-name> --resource-group <rg-name> \
//     --set redisConfiguration.notify-keyspace-events=Ex

const redis = new cache.Redis("redis", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    name: `scribbl-${stack}-redis`,
    sku: {
        name: "Standard",
        family: "C",
        capacity: 0, // C0 — upgrade to C1+ for production workloads
    },
    enableNonSslPort: true,
    minimumTlsVersion: "1.2",
    redisVersion: "6.0",
    redisConfiguration: {
        maxmemoryPolicy: "noeviction",
        maxfragmentationmemoryReserved: "30",
        maxmemoryDelta: "30",
        maxmemoryReserved: "30",
    },
});

const redisPrimaryKey = pulumi
    .all([resourceGroup.name, redis.name])
    .apply(([rgName, name]) => cache.listRedisKeys({ resourceGroupName: rgName, name }))
    .apply((keys) => keys.primaryKey);

// ── Container Apps Environment ─────────────────────────────────────────────────

const containerAppEnv = new app.ManagedEnvironment("env", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    environmentName: `scribbl-${stack}-env`,
    zoneRedundant: false,
    appLogsConfiguration: {
        destination: "log-analytics",
        logAnalyticsConfiguration: {
            customerId: logAnalytics.customerId,
            sharedKey: logAnalyticsSharedKey,
        },
    },
}, {
    // sharedKey is write-only (never returned by Azure API), so imported state
    // never has it. ignoreChanges prevents a spurious replace on imported stacks.
    ignoreChanges: ["appLogsConfiguration"],
});

// ── Custom Domain Certificates ─────────────────────────────────────────────────
//
// Phase 2: After DNS A records + TXT verification records are created,
// set `enableCustomDomain: true` in Pulumi config and re-run `pulumi up`.
// Azure will validate DNS and issue free managed TLS certificates.

let backendCustomDomains: { name: string; certificateId: pulumi.Output<string>; bindingType: string }[] | undefined;
let frontendCustomDomains: { name: string; certificateId: pulumi.Output<string>; bindingType: string }[] | undefined;

if (enableCustomDomain) {
    const backendCert = new app.ManagedCertificate("backend-cert", {
        resourceGroupName: resourceGroup.name,
        environmentName: containerAppEnv.name,
        managedCertificateName: "mc-scribbl-prod-e-api-scribbl-sing-5513",
        location: resourceGroup.location,
        properties: {
            subjectName: apiDomain,
            domainControlValidation: app.ManagedCertificateDomainControlValidation.HTTP,
        },
    });

    const frontendCert = new app.ManagedCertificate("frontend-cert", {
        resourceGroupName: resourceGroup.name,
        environmentName: containerAppEnv.name,
        managedCertificateName: "mc-scribbl-prod-e-scribbl-singhalk-8752",
        location: resourceGroup.location,
        properties: {
            subjectName: domain,
            domainControlValidation: app.ManagedCertificateDomainControlValidation.HTTP,
        },
    });

    backendCustomDomains = [
        {
            name: apiDomain,
            certificateId: backendCert.id,
            bindingType: "SniEnabled",
        },
    ];

    frontendCustomDomains = [
        {
            name: domain,
            certificateId: frontendCert.id,
            bindingType: "SniEnabled",
        },
    ];
}

// ── Backend Container App ──────────────────────────────────────────────────────

const backendApp = new app.ContainerApp("backend", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    containerAppName: `scribbl-${stack}-backend`,
    managedEnvironmentId: containerAppEnv.id,
    identity: { type: app.ManagedServiceIdentityType.None },
    configuration: {
        activeRevisionsMode: app.ActiveRevisionsMode.Single,
        maxInactiveRevisions: 100,
        ingress: {
            external: true,
            targetPort: 4000,
            exposedPort: 0,
            transport: "Auto" as any,
            allowInsecure: false,
            traffic: [{ latestRevision: true, weight: 100 }],
            customDomains: backendCustomDomains,
        },
        registries: [
            {
                server: registry.loginServer,
                username: acrUsername,
                passwordSecretRef: "acr-password",
                identity: "",
            },
        ],
        secrets: [
            { name: "acr-password", value: acrPassword },
            { name: "secret-key-base", value: secretKeyBase },
            { name: "redis-password", value: redisPrimaryKey },
        ],
    },
    template: {
        revisionSuffix: "",
        containers: [
            {
                name: "backend",
                image: pulumi.interpolate`${registry.loginServer}/scribbl-backend:latest`,
                resources: { cpu: 0.5, memory: "1Gi" },
                env: [
                    { name: "PHX_SERVER", value: "true" },
                    { name: "PHX_HOST", value: apiDomain },
                    { name: "PORT", value: "4000" },
                    { name: "SECRET_KEY_BASE", secretRef: "secret-key-base" },
                    { name: "REDIS_HOST", value: redis.hostName },
                    { name: "REDIS_PORT", value: "6379" },
                    { name: "REDIS_DB", value: "0" },
                    { name: "REDIS_PASSWORD", secretRef: "redis-password" },
                    { name: "CORS_ALLOWED_ORIGINS", value: `https://${domain}` },
                ],
            },
        ],
        scale: {
            minReplicas: 1,
            maxReplicas: backendMaxReplicas,
            rules: [
                {
                    name: "http-scaling",
                    http: { metadata: { concurrentRequests: "100" } },
                },
            ],
        },
    },
}, {
    ignoreChanges: ["environmentId", "configuration.secrets"],
});

// ── Frontend Container App ─────────────────────────────────────────────────────
//
// Build the frontend image with the backend API domain:
//   docker build --build-arg NEXT_PUBLIC_BACKEND_URL=https://api.scribbl.singhalkarun.com ...

const frontendApp = new app.ContainerApp("frontend", {
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    containerAppName: `scribbl-${stack}-frontend`,
    managedEnvironmentId: containerAppEnv.id,
    identity: { type: app.ManagedServiceIdentityType.None },
    configuration: {
        activeRevisionsMode: app.ActiveRevisionsMode.Single,
        ingress: {
            external: true,
            targetPort: 3000,
            exposedPort: 0,
            transport: "Auto" as any,
            allowInsecure: false,
            traffic: [{ latestRevision: true, weight: 100 }],
            customDomains: frontendCustomDomains,
        },
        registries: [
            {
                server: registry.loginServer,
                username: acrUsername,
                passwordSecretRef: "acr-password",
                identity: "",
            },
        ],
        secrets: [{ name: "acr-password", value: acrPassword }],
    },
    template: {
        revisionSuffix: "",
        containers: [
            {
                name: "frontend",
                image: pulumi.interpolate`${registry.loginServer}/scribbl-frontend:latest`,
                resources: { cpu: 0.25, memory: "0.5Gi" },
                env: [
                    { name: "HOSTNAME", value: "0.0.0.0" },
                    { name: "PORT", value: "3000" },
                ],
            },
        ],
        scale: {
            minReplicas: 1,
            maxReplicas: 2,
        },
    },
}, {
    ignoreChanges: ["environmentId", "configuration.secrets"],
});

// ── Outputs ────────────────────────────────────────────────────────────────────

export const resourceGroupName = resourceGroup.name;
export const acrLoginServer = registry.loginServer;
export const backendDefaultUrl = pulumi.interpolate`https://${backendApp.latestRevisionFqdn}`;
export const frontendDefaultUrl = pulumi.interpolate`https://${frontendApp.latestRevisionFqdn}`;
export const redisHostname = redis.hostName;

// DNS setup: point these domains to the static IP via A records
export const staticIp = containerAppEnv.staticIp;
export const customDomainVerificationId = containerAppEnv.customDomainConfiguration.apply(
    (c) => c?.customDomainVerificationId ?? "",
);

// After `pulumi up`, create these DNS records:
//
//   A records (both point to staticIp output):
//     scribbl.singhalkarun.com       →  <staticIp>
//     api.scribbl.singhalkarun.com   →  <staticIp>
//
//   TXT verification records (both use customDomainVerificationId output):
//     asuid.scribbl.singhalkarun.com       →  <customDomainVerificationId>
//     asuid.api.scribbl.singhalkarun.com   →  <customDomainVerificationId>
//
// Then: pulumi config set enableCustomDomain true && pulumi up
