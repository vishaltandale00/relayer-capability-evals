import type { BoundAutonomousCase, CaseContentDigest, EvalCheck, PublicAutonomousCaseSnapshot } from "@relayer/eval-runner";

export interface CapabilityMaterializeContext {
  readonly caseId: string;
  readonly workspaceDirectory: string;
  readonly cacheDirectory?: string;
  readonly platform?: NodeJS.Platform;
}

export interface CapabilityGradeContext {
  readonly caseId: string;
  readonly workspaceDirectory: string;
  readonly fixture: Readonly<Record<string, unknown>>;
  readonly threadDefinition: Readonly<Record<string, unknown>>;
}

export interface CapabilityCaseRegistration {
  readonly boundCase: BoundAutonomousCase<unknown>;
  readonly definition: Readonly<Record<string, unknown>> & {
    readonly id: string;
    readonly caseSnapshot: PublicAutonomousCaseSnapshot;
    readonly caseSnapshotDigest: CaseContentDigest;
  };
  readonly available: boolean;
  readonly unavailableReason: string | null;
  materialize(context: CapabilityMaterializeContext): Promise<unknown>;
  grade(context: CapabilityGradeContext): Promise<readonly EvalCheck[]>;
  evaluateMandatoryGate(gate: unknown, checks: readonly EvalCheck[]): {
    readonly complete: boolean;
    readonly passed: boolean;
    readonly matched: readonly EvalCheck[];
  };
}

export function createEvalCatalog(): Promise<{
  readonly schemaVersion: 1;
  readonly cases: readonly CapabilityCaseRegistration[];
  readonly suites: readonly unknown[];
}>;

export function createSaasRegistration(
  runtime: unknown,
  availability: { readonly available: boolean; readonly unavailableReason: string | null },
  dependencies?: {
    materialize?: (options: any) => Promise<any>;
    grade?: (options: any) => Promise<readonly EvalCheck[]>;
    Inspector?: new (runtime: any) => any;
  },
): CapabilityCaseRegistration;
