import type { BoundAutonomousCase, CapabilitySuiteManifestV1, PublicCapabilitySuiteV1, ResolvedCapabilitySuiteV1 } from "@relayer/eval-runner";
export declare const HARNESS_CAPABILITY_PILOT_V1_ID: "harness-capability-pilot-v1";
type AnyBoundCase = BoundAutonomousCase<unknown>;
export declare const orderedCases: readonly AnyBoundCase[];
/**
 * Version 1 is intentionally declared once and validated against the live case
 * registry below. A later accepted change creates a new suite version.
 */
export declare const harnessCapabilityPilotV1Manifest: CapabilitySuiteManifestV1;
export declare function resolveHarnessCapabilityPilotV1(): ResolvedCapabilitySuiteV1;
export declare function getCapabilitySuiteCatalog(): readonly PublicCapabilitySuiteV1[];
export {};
