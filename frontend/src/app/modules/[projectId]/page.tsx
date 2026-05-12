"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeft,
  Box,
  Building2,
  CheckCircle2,
  Eye,
  Layers,
  PencilRuler,
  Route,
  ShieldAlert,
  SunMedium,
  Workflow,
  Ruler,
  Zap,
} from "lucide-react";
import { formatImperial } from "@/lib/calculations";

type ModuleContext = {
  project_id: string;
  project_name: string;
  element_counts: {
    walls: number;
    doors: number;
    windows: number;
    all: number;
  };
  structural_counts: {
    column: number;
    beam: number;
    slab: number;
    wall: number;
  };
  material_count: number;
  estimated_floor_area_m2: number;
  estimated_wall_length_m: number;
  estimated_wall_area_m2: number;
  estimated_opening_area_m2: number;
  bbox_mm: {
    width: number;
    depth: number;
  };
  routing_obstacles: Array<{
    id: string;
    type: string;
    min: number[];
    max: number[];
  }>;
  energy_defaults: {
    floor_area_m2: number;
    wall_area_m2: number;
    window_area_m2: number;
    occupancy: number;
    climate_factor: number;
    roof_exposure: number;
    shading_factor: number;
  };
  materials: Array<{
    id: string;
    name: string;
    category: string | null;
  }>;
  module_flags: {
    rebar_bbs: boolean;
    mep: boolean;
    energy: boolean;
    rendering: boolean;
  };
};

type ElectricalTemplateForm = {
  room_id?: string;
  building_type:
    | "college"
    | "school"
    | "university"
    | "hospital"
    | "commercial_complex"
    | "mall"
    | "government_office"
    | "private_office"
    | "residential_high_rise";
  mep_discipline:
    | "electrical"
    | "sewage"
    | "fire_fighting_pipeline"
    | "fire_alarm"
    | "hvac";
  room_type:
    | "classroom"
    | "corridor"
    | "staff_room"
    | "library"
    | "auditorium"
    | "washroom"
    | "lab"
    | "reception"
    | "chemistry_lab"
    | "physics_lab"
    | "computer_lab"
    | "principal_office"
    | "meeting_room"
    | "icu"
    | "emergency_ward"
    | "patient_waiting"
    | "blood_collection_lab"
    | "operation_theatre";
  room_name: string;
  room_width_mm: number;
  room_depth_mm: number;
  ceiling_height_mm: number;
  occupancy: number;
  entry_side: "north" | "south" | "east" | "west";
  teaching_wall_side: "" | "north" | "south" | "east" | "west";
  stage_depth_mm: number;
  seating_rows: number;
  preferred_voltage_v: number;
  include_emergency_circuit: boolean;
};

type ElectricalTemplateResult = {
  project_id: string;
  project_name: string;
  template_id: string;
  room: {
    name: string;
    type: ElectricalTemplateForm["room_type"];
    building_type?: string;
    mep_discipline?: string;
    teaching_wall_side?: string | null;
    width_mm: number;
    depth_mm: number;
    ceiling_height_mm: number;
    occupancy: number;
    entry_side: ElectricalTemplateForm["entry_side"];
  };
  summary: {
    fixtures: number;
    circuits: number;
    light_points: number;
    socket_points: number;
    emergency_points: number;
  };
  fixtures: Array<{
    id: string;
    type: string;
    x_mm: number;
    y_mm: number;
    elevation_mm: number;
    circuit_id: string;
    wall_side: string | null;
    note: string;
  }>;
  circuits: Array<{
    id: string;
    label: string;
    breaker: string;
    load_type: string;
    voltage_v: number;
    route: Array<{ x: number; y: number; z: number; clearance_mm?: number }>;
    length_mm: number;
  }>;
  rules_used: string[];
  manual_edit_hints: string[];
};

type DetectedRoom = {
  id: string;
  name: string;
  width_mm: number;
  depth_mm: number;
  origin_x_mm: number;
  origin_y_mm: number;
  area_m2: number;
  type?: string;
};

type RebarResult = {
  project_id: string;
  project_name: string;
  outputs: {
    main_cut_length_mm: number;
    lap_length_mm: number;
    stirrup_cut_length_mm: number;
    stirrup_count: number;
    rcc_volume_m3: number;
    steel_weight_kg: number;
  };
  schedule: Array<{
    member: string;
    bar_type: string;
    diameter_mm: number;
    quantity: number;
    cut_length_mm: number;
    lap_length_mm?: number;
    weight_kg: number;
  }>;
  notes: string[];
};

type RouteResult = {
  project_id: string;
  project_name: string;
  system: string;
  status: string;
  warnings: string[];
  used_networkx: boolean;
  path: Array<{ x: number; y: number; z: number }>;
  length_mm: number;
  length_m: number;
  turn_count: number;
  obstacle_count: number;
};

type FixturePlacementResult = {
  project_id: string;
  fixtures: Array<{
    id: string;
    type: string;
    x_mm: number;
    y_mm: number;
    note: string;
  }>;
};

type ClearanceResult = {
  project_id: string;
  checked: number;
  violations: Array<{
    a_id: string;
    b_id: string;
    a_type: string;
    b_type: string;
    clearance_mm: number;
    min_required_mm: number;
    overlap: boolean;
  }>;
};

type FlowResult = {
  project_id: string;
  system: string;
  flow_lps: number;
  pipe_diameter_mm: number;
  length_m: number;
  velocity_mps: number;
  pressure_drop_kpa: number;
  allowable_velocity_mps: number;
  status: string;
  notes: string[];
};

type EnergyResult = {
  project_id: string;
  cooling_load_kw: number;
  solar_heat_gain_kw: number;
  daylight_score: number;
  energy_score: number;
  recommendations: string[];
};

type RenderingResult = {
  project_id: string;
  quality: string;
  walkthrough: boolean;
  sun_study: boolean;
  material_preview: boolean;
  settings: {
    samples: number;
    shadow: string;
    exposure: number;
  };
  camera: {
    distance: number;
    target: number[];
    fov: number;
  };
  materials: Array<{
    id: string;
    name: string;
    category: string | null;
    color: string | null;
  }>;
  render_notes: string[];
};

type EscrowMilestone = {
  id: string;
  project_id: string;
  boq_item_id: string;
  amount: number;
  currency: string;
  engineer_approved: boolean;
  client_approved: boolean;
  payment_status: string;
  triggered_at: string | null;
  created_at: string;
};

type PluginResult = {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  sdk_type: "python" | "javascript";
  version: string;
  container_image?: string | null;
  status: string;
  manifest: Record<string, unknown>;
  created_at: string;
};

type OrganizationResult = {
  id: string;
  name: string;
  sso_provider?: string;
  sso_issuer?: string | null;
  created_at: string;
};

type AuditResult = {
  id: string;
  project_id: string | null;
  organization_id: string | null;
  actor: string;
  action: string;
  entity: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type RebarForm = {
  member_type: "beam" | "column" | "slab" | "footing";
  length_mm: number;
  width_mm: number;
  depth_mm: number;
  bar_diameter_mm: number;
  main_bar_count: number;
  stirrup_diameter_mm: number;
  stirrup_spacing_mm: number;
  cover_mm: number;
  lap_type: "tension" | "compression";
  hook_length_mm: number;
  quantity: number;
};

type RouteForm = {
  system: "pipe" | "duct" | "cable_tray";
  start_x_mm: number;
  start_y_mm: number;
  end_x_mm: number;
  end_y_mm: number;
  clearance_mm: number;
  grid_mm: number;
};

type ClearanceForm = {
  room_width_mm: number;
  room_depth_mm: number;
  fixture_count: number;
  fixture_clearance_mm: number;
  fixture_depth_mm: number;
  min_clearance_mm: number;
};

type FlowForm = {
  system: "pipe" | "duct" | "cable_tray";
  flow_lps: number;
  pipe_diameter_mm: number;
  length_m: number;
  allowable_velocity_mps: number;
};

type EnergyForm = {
  floor_area_m2: number;
  wall_area_m2: number;
  window_area_m2: number;
  occupancy: number;
  climate_factor: number;
  roof_exposure: number;
  shading_factor: number;
};

type RenderingForm = {
  quality: "draft" | "client" | "presentation";
  walkthrough: boolean;
  sun_study: boolean;
  material_preview: boolean;
};

type EscrowForm = {
  boq_item_id: string;
  amount: number;
  currency: string;
  actor: string;
};

type PluginForm = {
  name: string;
  slug: string;
  sdk_type: "python" | "javascript";
  version: string;
  container_image: string;
  actor: string;
};

type AdminForm = {
  org_name: string;
  sso_provider: string;
  sso_issuer: string;
  member_email: string;
  member_role: "viewer" | "editor" | "approver" | "admin";
  access_email: string;
  access_permission: "read" | "edit" | "approve" | "admin";
  plan: "team" | "business" | "enterprise";
  duration_days: number;
  actor: string;
};

const apiBase = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function SectionCard({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-3xl border border-white/8 bg-[#0f1222] p-6 shadow-2xl shadow-black/20"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-blue-300/80">
            <Icon className="h-4 w-4" /> Module
          </div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  helper?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
      />
      {helper ? (
        <span className="block text-xs text-slate-500">{helper}</span>
      ) : null}
    </label>
  );
}

function mmToFeetInches(mm: number): { feet: number; inches: number } {
  const totalInches = Math.max(0, mm) / 25.4;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

function feetInchesToMm(feet: number, inches: number): number {
  const safeFeet = Number.isFinite(feet) ? feet : 0;
  const safeInches = Number.isFinite(inches) ? inches : 0;
  return Math.max(0, Math.round((safeFeet * 12 + safeInches) * 25.4));
}

function MeasurementField({
  label,
  valueMm,
  onChangeMm,
  unitMode,
  minMm,
  helper,
}: {
  label: string;
  valueMm: number;
  onChangeMm: (valueMm: number) => void;
  unitMode: "mm" | "imperial";
  minMm?: number;
  helper?: string;
}) {
  const imperial = mmToFeetInches(valueMm);

  return (
    <label className="space-y-1 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {unitMode === "mm" ? (
        <>
          <input
            type="number"
            value={valueMm}
            min={minMm}
            onChange={(e) => onChangeMm(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
          />
          <span className="block text-xs text-slate-500">
            {helper || `Stored in mm`}
          </span>
        </>
      ) : (
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <label className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-500">
              Feet
            </span>
            <input
              type="number"
              min={0}
              value={imperial.feet}
              onChange={(e) =>
                onChangeMm(
                  feetInchesToMm(Number(e.target.value), imperial.inches),
                )
              }
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-500">
              Inches
            </span>
            <input
              type="number"
              min={0}
              max={11}
              value={imperial.inches}
              onChange={(e) =>
                onChangeMm(
                  feetInchesToMm(imperial.feet, Number(e.target.value)),
                )
              }
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
            />
          </label>
          <span className="col-span-2 block text-xs text-slate-500">
            {helper || `Stored as ${valueMm} mm`}
          </span>
        </div>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-slate-950"
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-blue-500"
      />
    </label>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-white">{value}</div>
      {helper ? (
        <div className="mt-1 text-xs text-slate-500">{helper}</div>
      ) : null}
    </div>
  );
}

export default function AdvancedModulesPage() {
  const params = useParams<{ projectId?: string | string[] }>();
  const projectId = Array.isArray(params.projectId)
    ? params.projectId[0]
    : params.projectId || "";

  const [context, setContext] = useState<ModuleContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rebarForm, setRebarForm] = useState<RebarForm>({
    member_type: "beam",
    length_mm: 3000,
    width_mm: 230,
    depth_mm: 450,
    bar_diameter_mm: 12,
    main_bar_count: 4,
    stirrup_diameter_mm: 8,
    stirrup_spacing_mm: 150,
    cover_mm: 25,
    lap_type: "tension",
    hook_length_mm: 90,
    quantity: 1,
  });
  const [rebarResult, setRebarResult] = useState<RebarResult | null>(null);
  const [rebarBusy, setRebarBusy] = useState(false);

  const [routeForm, setRouteForm] = useState<RouteForm>({
    system: "pipe",
    start_x_mm: -500,
    start_y_mm: -500,
    end_x_mm: 5000,
    end_y_mm: 4000,
    clearance_mm: 150,
    grid_mm: 500,
  });
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);

  const [clearanceForm, setClearanceForm] = useState<ClearanceForm>({
    room_width_mm: 4000,
    room_depth_mm: 3000,
    fixture_count: 4,
    fixture_clearance_mm: 300,
    fixture_depth_mm: 450,
    min_clearance_mm: 300,
  });
  const [placementResult, setPlacementResult] =
    useState<FixturePlacementResult | null>(null);
  const [clearanceResult, setClearanceResult] =
    useState<ClearanceResult | null>(null);
  const [mepBusy, setMepBusy] = useState(false);

  const [electricalForm, setElectricalForm] = useState<ElectricalTemplateForm>({
    building_type: "school",
    mep_discipline: "electrical",
    room_type: "classroom",
    room_name: "Classroom",
    room_width_mm: 7200,
    room_depth_mm: 6000,
    ceiling_height_mm: 3300,
    occupancy: 40,
    entry_side: "south",
    teaching_wall_side: "",
    stage_depth_mm: 6000,
    seating_rows: 0,
    preferred_voltage_v: 230,
    include_emergency_circuit: true,
  });
  const [electricalRooms, setElectricalRooms] = useState<DetectedRoom[]>([]);
  const [electricalResult, setElectricalResult] =
    useState<ElectricalTemplateResult | null>(null);
  const [electricalBusy, setElectricalBusy] = useState(false);
  const [electricalUnits, setElectricalUnits] = useState<"mm" | "imperial">(
    "imperial",
  );

  const [flowForm, setFlowForm] = useState<FlowForm>({
    system: "pipe",
    flow_lps: 2,
    pipe_diameter_mm: 100,
    length_m: 10,
    allowable_velocity_mps: 2.5,
  });
  const [flowResult, setFlowResult] = useState<FlowResult | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);

  const [energyForm, setEnergyForm] = useState<EnergyForm>({
    floor_area_m2: 50,
    wall_area_m2: 120,
    window_area_m2: 8,
    occupancy: 4,
    climate_factor: 1,
    roof_exposure: 1,
    shading_factor: 1,
  });
  const [energyResult, setEnergyResult] = useState<EnergyResult | null>(null);
  const [energyBusy, setEnergyBusy] = useState(false);

  const [renderForm, setRenderForm] = useState<RenderingForm>({
    quality: "client",
    walkthrough: true,
    sun_study: true,
    material_preview: true,
  });
  const [renderResult, setRenderResult] = useState<RenderingResult | null>(
    null,
  );
  const [renderBusy, setRenderBusy] = useState(false);

  const [escrowForm, setEscrowForm] = useState<EscrowForm>({
    boq_item_id: "BOQ-001",
    amount: 10000,
    currency: "USD",
    actor: "engineer@local",
  });
  const [milestones, setMilestones] = useState<EscrowMilestone[]>([]);
  const [escrowBusy, setEscrowBusy] = useState(false);

  const [pluginForm, setPluginForm] = useState<PluginForm>({
    name: "Custom BOQ Template",
    slug: "custom-boq-template",
    sdk_type: "python",
    version: "0.1.0",
    container_image: "",
    actor: "consultant@local",
  });
  const [plugins, setPlugins] = useState<PluginResult[]>([]);
  const [pluginRunOutput, setPluginRunOutput] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [pluginBusy, setPluginBusy] = useState(false);

  const [adminForm, setAdminForm] = useState<AdminForm>({
    org_name: "Acme Infra",
    sso_provider: "keycloak",
    sso_issuer: "https://sso.local/realms/acme",
    member_email: "manager@acme.com",
    member_role: "admin",
    access_email: "engineer@acme.com",
    access_permission: "edit",
    plan: "enterprise",
    duration_days: 365,
    actor: "admin@local",
  });
  const [organization, setOrganization] = useState<OrganizationResult | null>(
    null,
  );
  const [licenseInfo, setLicenseInfo] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditResult[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setError("Project id is missing.");
      setLoadingContext(false);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        setLoadingContext(true);
        setError(null);
        const res = await fetch(
          `${apiBase()}/api/projects/${projectId}/modules/context`,
          {
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          throw new Error(`Failed to load module context (${res.status})`);
        }
        const data = (await res.json()) as ModuleContext;
        setContext(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setLoadingContext(false);
      }
    };

    load();
    return () => controller.abort();
  }, [projectId]);

  useEffect(() => {
    if (!context) return;

    setRebarForm((prev) => ({
      ...prev,
      length_mm: Math.max(
        prev.length_mm,
        Math.round(context.estimated_wall_length_m * 1000) || prev.length_mm,
      ),
      width_mm: prev.width_mm || context.bbox_mm.width || 230,
      depth_mm: prev.depth_mm || context.bbox_mm.depth || 450,
    }));

    setRouteForm((prev) => ({
      ...prev,
      start_x_mm: -500,
      start_y_mm: -500,
      end_x_mm: Math.max(3000, Math.round(context.bbox_mm.width + 500)),
      end_y_mm: Math.max(2000, Math.round(context.bbox_mm.depth + 500)),
    }));

    setClearanceForm((prev) => ({
      ...prev,
      room_width_mm: Math.max(
        3000,
        Math.round(context.bbox_mm.width || prev.room_width_mm),
      ),
      room_depth_mm: Math.max(
        2500,
        Math.round(context.bbox_mm.depth || prev.room_depth_mm),
      ),
    }));

    setEnergyForm((prev) => ({
      ...prev,
      ...context.energy_defaults,
    }));

    setElectricalForm((prev) => ({
      ...prev,
      room_width_mm: Math.max(
        prev.room_width_mm,
        Math.round(context.bbox_mm.width || prev.room_width_mm),
      ),
      room_depth_mm: Math.max(
        prev.room_depth_mm,
        Math.round(context.bbox_mm.depth || prev.room_depth_mm),
      ),
      occupancy: Math.max(prev.occupancy, context.energy_defaults.occupancy),
    }));
  }, [context]);

  useEffect(() => {
    if (!projectId) return;
    const loadRooms = async () => {
      try {
        const res = await fetch(
          `${apiBase()}/api/projects/${projectId}/drawing`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const rooms = Array.isArray(data?.elements) ? data.elements : [];
        const detectedRooms: DetectedRoom[] = rooms
          .filter(
            (element: any) =>
              element?.type === "room" && Array.isArray(element.vertices),
          )
          .map((room: any) => {
            const xs = room.vertices.map((vertex: any) =>
              Number(vertex.x || 0),
            );
            const ys = room.vertices.map((vertex: any) =>
              Number(vertex.y || 0),
            );
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const widthMm = Math.max(
              0,
              Math.round((Math.max(...xs) - minX) * 50),
            );
            const depthMm = Math.max(
              0,
              Math.round((Math.max(...ys) - minY) * 50),
            );
            return {
              id: room.id,
              name: room.name || room.id,
              width_mm: widthMm,
              depth_mm: depthMm,
              origin_x_mm: Math.round(minX * 50),
              origin_y_mm: Math.round(minY * 50),
              area_m2: room.properties?.area ?? (widthMm * depthMm) / 1000000,
              type: room.metadata?.room_type || room.roomType || room.type,
            };
          });
        setElectricalRooms(detectedRooms);
      } catch {
        setElectricalRooms([]);
      }
    };
    loadRooms();
  }, [projectId, electricalResult]);

  const postJson = async <T,>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || `Request failed (${res.status})`);
    }
    return (await res.json()) as T;
  };

  const runRebarCalc = async () => {
    if (!projectId) return;
    setRebarBusy(true);
    try {
      const result = await postJson<RebarResult>(
        `/api/projects/${projectId}/modules/rebar-bbs/calculate`,
        rebarForm,
      );
      setRebarResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRebarBusy(false);
    }
  };

  const runRoute = async () => {
    if (!projectId) return;
    setRouteBusy(true);
    try {
      const result = await postJson<RouteResult>(
        `/api/projects/${projectId}/modules/mep/route`,
        {
          ...routeForm,
          start: { x: routeForm.start_x_mm, y: routeForm.start_y_mm },
          end: { x: routeForm.end_x_mm, y: routeForm.end_y_mm },
          obstacles: context?.routing_obstacles ?? [],
        },
      );
      setRouteResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRouteBusy(false);
    }
  };

  const runClearance = async () => {
    if (!projectId) return;
    setMepBusy(true);
    try {
      const placement = await postJson<FixturePlacementResult>(
        `/api/projects/${projectId}/modules/mep/fixture-placement`,
        {
          room_width_mm: clearanceForm.room_width_mm,
          room_depth_mm: clearanceForm.room_depth_mm,
          count: clearanceForm.fixture_count,
          fixture_clearance_mm: clearanceForm.fixture_clearance_mm,
          fixture_depth_mm: clearanceForm.fixture_depth_mm,
        },
      );
      setPlacementResult(placement);

      const fixtures = placement.fixtures.map((fixture, index) => ({
        id: fixture.id,
        type: index % 2 === 0 ? "pipe_fixture" : "duct_fixture",
        min: [fixture.x_mm - 150, fixture.y_mm - 150, 0],
        max: [fixture.x_mm + 150, fixture.y_mm + 150, 0],
      }));

      const clearance = await postJson<ClearanceResult>(
        `/api/projects/${projectId}/modules/mep/clearance-check`,
        {
          fixtures,
          min_clearance_mm: clearanceForm.min_clearance_mm,
        },
      );
      setClearanceResult(clearance);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMepBusy(false);
    }
  };

  const runFlowCheck = async () => {
    if (!projectId) return;
    setFlowBusy(true);
    try {
      const result = await postJson<FlowResult>(
        `/api/projects/${projectId}/modules/mep/pressure-flow-check`,
        flowForm,
      );
      setFlowResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFlowBusy(false);
    }
  };

  const runElectricalTemplate = async () => {
    if (!projectId) return;
    if (electricalForm.mep_discipline !== "electrical") {
      setError(
        "Electrical template preview only supports MEP discipline “Electrical”. Other systems use hydraulic/fire/HVAC modules.",
      );
      return;
    }
    setElectricalBusy(true);
    try {
      const payload = {
        ...electricalForm,
        teaching_wall_side:
          electricalForm.teaching_wall_side === ""
            ? null
            : electricalForm.teaching_wall_side,
      };
      const result = await postJson<ElectricalTemplateResult>(
        `/api/projects/${projectId}/modules/electrical/template-preview`,
        payload,
      );
      setElectricalResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setElectricalBusy(false);
    }
  };

  const applyElectricalTemplateToDrawing = async () => {
    if (!projectId || !electricalResult) return;
    setElectricalBusy(true);
    try {
      const currentRes = await fetch(
        `${apiBase()}/api/projects/${projectId}/drawing`,
      );
      const currentData = currentRes.ok
        ? await currentRes.json()
        : { elements: [] };
      const existingElements = Array.isArray(currentData.elements)
        ? currentData.elements
        : [];

      // Find the selected room (must be detected/saved in drawing). If none, stop and ask user to save/select.
      const selectedRoom = electricalRooms.find(
        (room) => room.id === electricalForm.room_id,
      );
      if (!selectedRoom) {
        alert(
          "No detected room selected. Please save your drawing (click Save) and select a detected room before applying a template.",
        );
        setElectricalBusy(false);
        return;
      }

      const originX = selectedRoom.origin_x_mm / 50;
      const originY = selectedRoom.origin_y_mm / 50;

      // Helpers (canvas units)
      const MM_TO_CANVAS = 50;
      const OPENING_ATTACH_DISTANCE = 80; // pixels

      const getWallDirection = (wall: any) => {
        const dx = wall.endPoint.x - wall.startPoint.x;
        const dy = wall.endPoint.y - wall.startPoint.y;
        const len = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / len, y: dy / len };
        const normal = { x: -dir.y, y: dir.x };
        return { len, dir, normal };
      };

      const projectPointOnWall = (p: any, wall: any) => {
        const { len, dir } = getWallDirection(wall);
        const vx = p.x - wall.startPoint.x;
        const vy = p.y - wall.startPoint.y;
        const proj = vx * dir.x + vy * dir.y;
        const t = Math.max(0, Math.min(1, proj / len));
        const point = {
          x: wall.startPoint.x + dir.x * len * t,
          y: wall.startPoint.y + dir.y * len * t,
        };
        const distance = Math.hypot(p.x - point.x, p.y - point.y);
        return { t, point, distance };
      };

      const findNearestWall = (p: any, walls: any[]) => {
        let nearest: any = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        let nearestHit: any = null;
        for (const wall of walls) {
          const hit = projectPointOnWall(p, wall);
          if (hit.distance < nearestDistance) {
            nearestDistance = hit.distance;
            nearest = wall;
            nearestHit = hit;
          }
        }
        if (nearestDistance > OPENING_ATTACH_DISTANCE) return null;
        return { wall: nearest, hit: nearestHit };
      };

      const constrainOpeningOnWall = (
        p: any,
        wall: any,
        openingWidthMm = 80,
      ) => {
        if (!wall) return { position: p, orientation: 0 };
        const { len, dir } = getWallDirection(wall);
        const openingHalf = openingWidthMm / MM_TO_CANVAS / 2;
        const hit = projectPointOnWall(p, wall);
        let t = hit.t;
        if (Math.abs(t - 0.5) < 0.05) t = 0.5;
        const snappedDistance = Math.max(
          openingHalf,
          Math.min(len - openingHalf, t * len),
        );
        const snappedPos = {
          x: wall.startPoint.x + dir.x * snappedDistance,
          y: wall.startPoint.y + dir.y * snappedDistance,
        };
        const orientation = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
        return { position: snappedPos, orientation };
      };

      const walls = existingElements.filter((e: any) => e.type === "wall");

      const convertedElements = electricalResult.fixtures.map((fixture) => {
        const rawPos = {
          x: originX + fixture.x_mm / MM_TO_CANVAS,
          y: originY + fixture.y_mm / MM_TO_CANVAS,
        };

        // Default canvas position
        let finalPos = rawPos;

        // For wall-hosted fixtures (switch/socket) try snapping to nearest wall
        if (
          fixture.type === "switch" ||
          fixture.type === "socket" ||
          fixture.wall_side
        ) {
          const nearest = findNearestWall(rawPos, walls as any[]);
          if (nearest) {
            const constrained = constrainOpeningOnWall(
              rawPos,
              nearest.wall,
              80,
            );
            finalPos = constrained.position;
          }
        }

        const el: any = {
          id: fixture.id,
          type: "electrical_fixture",
          position: finalPos,
          width: 28,
          height: 28,
          rotation: 0,
          color:
            fixture.type === "light"
              ? "#facc15"
              : fixture.type === "socket"
                ? "#60a5fa"
                : fixture.type === "switch"
                  ? "#34d399"
                  : fixture.type === "emergency_light"
                    ? "#fb7185"
                    : "#f97316",
          fixtureType: fixture.type,
          circuitId: fixture.circuit_id,
          roomType: electricalResult.room.type,
          wallSide: fixture.wall_side,
          voltageV:
            electricalResult.circuits.find(
              (circuit) => circuit.id === fixture.circuit_id,
            )?.voltage_v ?? electricalForm.preferred_voltage_v,
          elevationMm: fixture.elevation_mm,
          metadata: {
            note: fixture.note,
            template_id: electricalResult.template_id,
            room_name: electricalResult.room.name,
          },
        };

        // Attach wall id if we snapped
        const attach = findNearestWall(el.position, walls as any[]);
        if (attach) {
          el.metadata = el.metadata || {};
          el.metadata.wall_assigned = attach.wall.id;
        }

        return el;
      });

      // Create polyline elements for circuits (wires)
      const convertedRoutes = (electricalResult.circuits || []).map(
        (c: any) => ({
          id: `route_${c.id}`,
          type: "polyline",
          points: (c.route || []).flatMap((p: any) => [
            originX + p.x / MM_TO_CANVAS,
            originY + p.y / MM_TO_CANVAS,
          ]),
          stroke: "#9ca3af",
          strokeWidth: 2,
          metadata: { circuitId: c.id },
        }),
      );

      const projectPointToRoute = (
        point: { x: number; y: number },
        routePoints: Array<{ x: number; y: number }>,
      ) => {
        if (routePoints.length < 2) return routePoints[0] || point;
        let bestPoint = routePoints[0];
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let i = 1; i < routePoints.length; i++) {
          const a = routePoints[i - 1];
          const b = routePoints[i];
          const abX = b.x - a.x;
          const abY = b.y - a.y;
          const abLenSq = abX * abX + abY * abY || 1;
          const apX = point.x - a.x;
          const apY = point.y - a.y;
          const t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / abLenSq));
          const projected = { x: a.x + abX * t, y: a.y + abY * t };
          const distance = Math.hypot(
            point.x - projected.x,
            point.y - projected.y,
          );
          if (distance < bestDistance) {
            bestDistance = distance;
            bestPoint = projected;
          }
        }

        return bestPoint;
      };

      const routePointsByCircuit = new Map<
        string,
        Array<{ x: number; y: number }>
      >(
        (electricalResult.circuits || []).map((c: any) => [
          c.id,
          (c.route || []).map((p: any) => ({
            x: originX + p.x / MM_TO_CANVAS,
            y: originY + p.y / MM_TO_CANVAS,
          })),
        ]),
      );

      const branchRoutes = convertedElements.flatMap((fixture: any) => {
        const routePoints = routePointsByCircuit.get(fixture.circuitId) || [];
        if (routePoints.length < 2) return [];
        const fixturePoint = {
          x: fixture.position.x,
          y: fixture.position.y,
        };
        const attachPoint = projectPointToRoute(fixturePoint, routePoints);
        return [
          {
            id: `branch_${fixture.id}`,
            type: "polyline",
            points: [
              fixturePoint.x,
              fixturePoint.y,
              attachPoint.x,
              attachPoint.y,
            ],
            stroke: "#6b7280",
            strokeWidth: 1.5,
            metadata: {
              circuitId: fixture.circuitId,
              branchId: fixture.id,
            },
          },
        ];
      });

      const merged = [
        ...existingElements.filter(
          (element: any) =>
            element.type !== "electrical_fixture" &&
            element.type !== "polyline",
        ),
        ...convertedElements,
        ...convertedRoutes,
        ...branchRoutes,
      ];

      const saveRes = await fetch(
        `${apiBase()}/api/projects/${projectId}/drawing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            elements: merged,
            timestamp: new Date().toISOString(),
          }),
        },
      );

      if (!saveRes.ok) {
        throw new Error(
          `Failed to apply electrical template (${saveRes.status})`,
        );
      }

      alert(
        "Electrical template applied to drawing. Open Modeling to see it in 2D and 3D.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setElectricalBusy(false);
    }
  };

  const runEnergy = async () => {
    if (!projectId) return;
    setEnergyBusy(true);
    try {
      const result = await postJson<EnergyResult>(
        `/api/projects/${projectId}/modules/energy/analyze`,
        energyForm,
      );
      setEnergyResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnergyBusy(false);
    }
  };

  const runRendering = async () => {
    if (!projectId) return;
    setRenderBusy(true);
    try {
      const result = await postJson<RenderingResult>(
        `/api/projects/${projectId}/modules/rendering/preset`,
        renderForm,
      );
      setRenderResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRenderBusy(false);
    }
  };

  const loadEscrowMilestones = async () => {
    if (!projectId) return;
    const res = await fetch(
      `${apiBase()}/api/projects/${projectId}/modules/payment-escrow/milestones`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as EscrowMilestone[];
    setMilestones(data);
  };

  const loadPlugins = async () => {
    if (!projectId) return;
    const res = await fetch(
      `${apiBase()}/api/projects/${projectId}/modules/marketplace/plugins`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as PluginResult[];
    setPlugins(data);
  };

  const loadAuditLogs = async () => {
    if (!projectId) return;
    const res = await fetch(
      `${apiBase()}/api/projects/${projectId}/modules/admin/audit-logs?limit=50`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as AuditResult[];
    setAuditLogs(data);
  };

  const startEscrow = async () => {
    if (!projectId) return;
    setEscrowBusy(true);
    try {
      await postJson<EscrowMilestone>(
        `/api/projects/${projectId}/modules/payment-escrow/start`,
        escrowForm,
      );
      await loadEscrowMilestones();
      await loadAuditLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEscrowBusy(false);
    }
  };

  const approveEscrow = async (
    milestoneId: string,
    who: "engineer" | "client",
  ) => {
    if (!projectId) return;
    setEscrowBusy(true);
    try {
      const path =
        who === "engineer"
          ? `/api/projects/${projectId}/modules/payment-escrow/${milestoneId}/engineer-approve`
          : `/api/projects/${projectId}/modules/payment-escrow/${milestoneId}/client-approve`;
      await postJson(path, {
        actor: who === "engineer" ? "engineer@local" : "client@local",
      });
      await loadEscrowMilestones();
      await loadAuditLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEscrowBusy(false);
    }
  };

  const registerPlugin = async () => {
    if (!projectId) return;
    setPluginBusy(true);
    try {
      await postJson<PluginResult>(
        `/api/projects/${projectId}/modules/marketplace/plugins`,
        {
          ...pluginForm,
          container_image: pluginForm.container_image || null,
          manifest: {
            hooks: ["boq-template", "validator", "report"],
            runtime: pluginForm.sdk_type,
          },
        },
      );
      await loadPlugins();
      await loadAuditLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPluginBusy(false);
    }
  };

  const runPlugin = async (pluginId: string) => {
    if (!projectId) return;
    setPluginBusy(true);
    try {
      const output = await postJson<Record<string, unknown>>(
        `/api/projects/${projectId}/modules/marketplace/plugins/${pluginId}/run`,
        {
          actor: pluginForm.actor,
          payload: {
            project_id: projectId,
            floor_area_m2: context?.estimated_floor_area_m2 ?? 0,
          },
        },
      );
      setPluginRunOutput(output);
      await loadAuditLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPluginBusy(false);
    }
  };

  const setupOrganization = async () => {
    if (!projectId) return;
    setAdminBusy(true);
    try {
      const org = await postJson<OrganizationResult>(
        `/api/projects/${projectId}/modules/admin/organizations`,
        {
          name: adminForm.org_name,
          sso_provider: adminForm.sso_provider,
          sso_issuer: adminForm.sso_issuer,
          actor: adminForm.actor,
        },
      );
      setOrganization(org);

      await postJson(
        `/api/projects/${projectId}/modules/admin/organizations/${org.id}/members`,
        {
          user_email: adminForm.member_email,
          role: adminForm.member_role,
          actor: adminForm.actor,
        },
      );

      await postJson(
        `/api/projects/${projectId}/modules/admin/project-access`,
        {
          organization_id: org.id,
          user_email: adminForm.access_email,
          permission: adminForm.access_permission,
          actor: adminForm.actor,
        },
      );

      const license = await postJson<Record<string, unknown>>(
        `/api/projects/${projectId}/modules/admin/license/issue`,
        {
          organization_id: org.id,
          plan: adminForm.plan,
          duration_days: adminForm.duration_days,
          actor: adminForm.actor,
        },
      );
      setLicenseInfo(license);
      await loadAuditLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdminBusy(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    loadEscrowMilestones();
    loadPlugins();
    loadAuditLogs();
  }, [projectId]);

  const contextReady = Boolean(context);

  return (
    <main className="min-h-screen bg-[#080b17] text-white">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#080b17]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-400 items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-blue-300/80">
                <Workflow className="h-4 w-4" /> Advanced Modules
              </div>
              <h1 className="mt-1 text-2xl font-bold">Project Module Hub</h1>
              <p className="text-xs text-slate-400">
                Project {projectId || "unknown"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-medium text-slate-300 transition hover:border-blue-500/30 hover:text-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-400 px-6 py-8">
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-linear-to-br from-blue-500/15 to-slate-900 p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-200/70">
              <Building2 className="h-4 w-4" /> Project Context
            </div>
            <div className="mt-2 text-xl font-bold">
              {context?.project_name || "Loading..."}
            </div>
            <div className="mt-2 text-sm text-slate-300">
              Project-scoped calculators and coordination tools.
            </div>
          </div>
          <MetricCard
            label="Walls / Openings"
            value={`${context?.element_counts.walls ?? 0} / ${(context?.element_counts.doors ?? 0) + (context?.element_counts.windows ?? 0)}`}
            helper="Uses the current 2D drawing."
          />
          <MetricCard
            label="Floor Area"
            value={`${(context?.estimated_floor_area_m2 ?? 0).toFixed(2)} m²`}
            helper="Approx. from the current drawing extents."
          />
          <MetricCard
            label="Materials"
            value={`${context?.material_count ?? 0}`}
            helper="Drives the render/material preview."
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <a
            href="#rebar-bbs"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <Ruler className="mr-2 inline h-4 w-4" /> Rebar / RCC / BBS
          </a>
          <a
            href="#mep"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <Route className="mr-2 inline h-4 w-4" /> MEP
          </a>
          <a
            href="#electrical"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <Zap className="mr-2 inline h-4 w-4" /> Electrical Templates
          </a>
          <a
            href="#energy"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <SunMedium className="mr-2 inline h-4 w-4" /> Energy
          </a>
          <a
            href="#rendering"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <Eye className="mr-2 inline h-4 w-4" /> Rendering
          </a>
          <a
            href="#payment-escrow"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <Workflow className="mr-2 inline h-4 w-4" /> Payment / Escrow
          </a>
          <a
            href="#marketplace"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <Box className="mr-2 inline h-4 w-4" /> Plugin Marketplace
          </a>
          <a
            href="#admin-security"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500/30 hover:text-white"
          >
            <ShieldAlert className="mr-2 inline h-4 w-4" /> Admin Security
          </a>
        </div>

        {!contextReady && loadingContext ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300">
            Loading module context...
          </div>
        ) : null}
        {error ? (
          <div className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="space-y-6">
          <SectionCard
            id="rebar-bbs"
            title="Rebar / RCC / BBS"
            description="Create rebar schedules, calculate steel weight, cut length, lap length, stirrups, and RCC quantity from project-driven or custom member inputs."
            icon={Ruler}
          >
            <div className="grid gap-4 lg:grid-cols-4">
              <SelectField
                label="Member Type"
                value={rebarForm.member_type}
                onChange={(value) =>
                  setRebarForm((prev) => ({
                    ...prev,
                    member_type: value as RebarForm["member_type"],
                  }))
                }
                options={[
                  { label: "Beam", value: "beam" },
                  { label: "Column", value: "column" },
                  { label: "Slab", value: "slab" },
                  { label: "Footing", value: "footing" },
                ]}
              />
              <NumberField
                label="Length (mm)"
                value={rebarForm.length_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, length_mm: value }))
                }
                min={1}
              />
              <NumberField
                label="Width (mm)"
                value={rebarForm.width_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, width_mm: value }))
                }
                min={1}
              />
              <NumberField
                label="Depth (mm)"
                value={rebarForm.depth_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, depth_mm: value }))
                }
                min={1}
              />
              <NumberField
                label="Bar Diameter (mm)"
                value={rebarForm.bar_diameter_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, bar_diameter_mm: value }))
                }
                min={1}
              />
              <NumberField
                label="Main Bars"
                value={rebarForm.main_bar_count}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, main_bar_count: value }))
                }
                min={1}
              />
              <NumberField
                label="Stirrup Dia. (mm)"
                value={rebarForm.stirrup_diameter_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({
                    ...prev,
                    stirrup_diameter_mm: value,
                  }))
                }
                min={1}
              />
              <NumberField
                label="Stirrup Spacing (mm)"
                value={rebarForm.stirrup_spacing_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({
                    ...prev,
                    stirrup_spacing_mm: value,
                  }))
                }
                min={1}
              />
              <NumberField
                label="Cover (mm)"
                value={rebarForm.cover_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, cover_mm: value }))
                }
                min={1}
              />
              <SelectField
                label="Lap Type"
                value={rebarForm.lap_type}
                onChange={(value) =>
                  setRebarForm((prev) => ({
                    ...prev,
                    lap_type: value as RebarForm["lap_type"],
                  }))
                }
                options={[
                  { label: "Tension", value: "tension" },
                  { label: "Compression", value: "compression" },
                ]}
              />
              <NumberField
                label="Hook Length (mm)"
                value={rebarForm.hook_length_mm}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, hook_length_mm: value }))
                }
                min={0}
              />
              <NumberField
                label="Quantity"
                value={rebarForm.quantity}
                onChange={(value) =>
                  setRebarForm((prev) => ({ ...prev, quantity: value }))
                }
                min={1}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={runRebarCalc}
                disabled={rebarBusy}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rebarBusy ? "Calculating..." : "Generate BBS"}
              </button>
              {context?.module_flags.rebar_bbs ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Structural data ready
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400">
                  No structural elements detected yet
                </span>
              )}
            </div>

            {rebarResult ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Steel Weight"
                    value={`${rebarResult.outputs.steel_weight_kg.toFixed(2)} kg`}
                  />
                  <MetricCard
                    label="RCC Volume"
                    value={`${rebarResult.outputs.rcc_volume_m3.toFixed(4)} m³`}
                  />
                  <MetricCard
                    label="Lap Length"
                    value={`${rebarResult.outputs.lap_length_mm.toFixed(0)} mm`}
                  />
                  <MetricCard
                    label="Stirrups"
                    value={`${rebarResult.outputs.stirrup_count}`}
                  />
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Bar Type</th>
                        <th className="px-4 py-3">Dia.</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Cut Length</th>
                        <th className="px-4 py-3">Lap</th>
                        <th className="px-4 py-3">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-[#0c1020] text-slate-200">
                      {rebarResult.schedule.map((row) => (
                        <tr key={`${row.bar_type}-${row.diameter_mm}`}>
                          <td className="px-4 py-3">{row.bar_type}</td>
                          <td className="px-4 py-3">{row.diameter_mm} mm</td>
                          <td className="px-4 py-3">{row.quantity}</td>
                          <td className="px-4 py-3">
                            {row.cut_length_mm.toFixed(0)} mm
                          </td>
                          <td className="px-4 py-3">
                            {row.lap_length_mm
                              ? `${row.lap_length_mm.toFixed(0)} mm`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {row.weight_kg.toFixed(2)} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {rebarResult.notes.map((note) => (
                    <div
                      key={note}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            id="mep"
            title="MEP"
            description="Route pipes, ducts, and cable trays with obstacle avoidance, place fixtures, run clearance checks, and review basic pressure/flow checks."
            icon={Route}
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Routing
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="System"
                    value={routeForm.system}
                    onChange={(value) =>
                      setRouteForm((prev) => ({
                        ...prev,
                        system: value as RouteForm["system"],
                      }))
                    }
                    options={[
                      { label: "Pipe", value: "pipe" },
                      { label: "Duct", value: "duct" },
                      { label: "Cable Tray", value: "cable_tray" },
                    ]}
                  />
                  <NumberField
                    label="Clearance (mm)"
                    value={routeForm.clearance_mm}
                    onChange={(value) =>
                      setRouteForm((prev) => ({ ...prev, clearance_mm: value }))
                    }
                    min={0}
                  />
                  <NumberField
                    label="Grid (mm)"
                    value={routeForm.grid_mm}
                    onChange={(value) =>
                      setRouteForm((prev) => ({ ...prev, grid_mm: value }))
                    }
                    min={100}
                  />
                  <NumberField
                    label="Start X (mm)"
                    value={routeForm.start_x_mm}
                    onChange={(value) =>
                      setRouteForm((prev) => ({ ...prev, start_x_mm: value }))
                    }
                  />
                  <NumberField
                    label="Start Y (mm)"
                    value={routeForm.start_y_mm}
                    onChange={(value) =>
                      setRouteForm((prev) => ({ ...prev, start_y_mm: value }))
                    }
                  />
                  <NumberField
                    label="End X (mm)"
                    value={routeForm.end_x_mm}
                    onChange={(value) =>
                      setRouteForm((prev) => ({ ...prev, end_x_mm: value }))
                    }
                  />
                  <NumberField
                    label="End Y (mm)"
                    value={routeForm.end_y_mm}
                    onChange={(value) =>
                      setRouteForm((prev) => ({ ...prev, end_y_mm: value }))
                    }
                  />
                </div>
                <button
                  onClick={runRoute}
                  disabled={routeBusy}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {routeBusy ? "Routing..." : "Route Services"}
                </button>
                <div className="text-xs text-slate-500">
                  {context?.routing_obstacles.length ?? 0} project obstacles are
                  included automatically.
                  {routeResult?.used_networkx
                    ? " NetworkX was used for graph routing."
                    : " Pure-Python routing fallback is available."}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Fixture Placement + Clearance
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <NumberField
                    label="Room Width (mm)"
                    value={clearanceForm.room_width_mm}
                    onChange={(value) =>
                      setClearanceForm((prev) => ({
                        ...prev,
                        room_width_mm: value,
                      }))
                    }
                    min={1}
                  />
                  <NumberField
                    label="Room Depth (mm)"
                    value={clearanceForm.room_depth_mm}
                    onChange={(value) =>
                      setClearanceForm((prev) => ({
                        ...prev,
                        room_depth_mm: value,
                      }))
                    }
                    min={1}
                  />
                  <NumberField
                    label="Fixture Count"
                    value={clearanceForm.fixture_count}
                    onChange={(value) =>
                      setClearanceForm((prev) => ({
                        ...prev,
                        fixture_count: value,
                      }))
                    }
                    min={1}
                  />
                  <NumberField
                    label="Fixture Clearance (mm)"
                    value={clearanceForm.fixture_clearance_mm}
                    onChange={(value) =>
                      setClearanceForm((prev) => ({
                        ...prev,
                        fixture_clearance_mm: value,
                      }))
                    }
                    min={0}
                  />
                  <NumberField
                    label="Fixture Depth (mm)"
                    value={clearanceForm.fixture_depth_mm}
                    onChange={(value) =>
                      setClearanceForm((prev) => ({
                        ...prev,
                        fixture_depth_mm: value,
                      }))
                    }
                    min={0}
                  />
                  <NumberField
                    label="Min Clearance (mm)"
                    value={clearanceForm.min_clearance_mm}
                    onChange={(value) =>
                      setClearanceForm((prev) => ({
                        ...prev,
                        min_clearance_mm: value,
                      }))
                    }
                    min={0}
                  />
                </div>
                <button
                  onClick={runClearance}
                  disabled={mepBusy}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mepBusy ? "Checking..." : "Place Fixtures + Check Clearance"}
                </button>
                <button
                  onClick={runFlowCheck}
                  disabled={flowBusy}
                  className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {flowBusy ? "Checking..." : "Pressure / Flow Check"}
                </button>
              </div>
            </div>

            {routeResult ? (
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <MetricCard
                  label="Route Length"
                  value={`${routeResult.length_m.toFixed(2)} m`}
                  helper={`${routeResult.turn_count} turns`}
                />
                <MetricCard
                  label="Status"
                  value={routeResult.status}
                  helper={
                    routeResult.used_networkx
                      ? "Graph routing"
                      : "Fallback routing"
                  }
                />
                <MetricCard
                  label="Obstacles"
                  value={`${routeResult.obstacle_count}`}
                  helper="Project walls used as blockers"
                />
                <MetricCard
                  label="Path Points"
                  value={`${routeResult.path.length}`}
                  helper="Polyline output"
                />
              </div>
            ) : null}

            {routeResult ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0c1020] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <Workflow className="h-4 w-4 text-blue-300" /> Routed Path
                </div>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">X</th>
                        <th className="px-4 py-3">Y</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {routeResult.path.map((pt, index) => (
                        <tr key={`${pt.x}-${pt.y}-${index}`}>
                          <td className="px-4 py-3">{index + 1}</td>
                          <td className="px-4 py-3">{pt.x.toFixed(1)} mm</td>
                          <td className="px-4 py-3">{pt.y.toFixed(1)} mm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {routeResult.warnings.length ? (
                  <div className="mt-3 space-y-2 text-sm text-amber-200">
                    {routeResult.warnings.map((warning) => (
                      <div
                        key={warning}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {placementResult ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0c1020] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <Box className="h-4 w-4 text-emerald-300" /> Fixture Placement
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {placementResult.fixtures.map((fixture) => (
                    <div
                      key={fixture.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"
                    >
                      <div className="font-bold text-white">{fixture.id}</div>
                      <div className="mt-1 text-slate-400">
                        X: {fixture.x_mm.toFixed(0)} mm
                      </div>
                      <div className="text-slate-400">
                        Y: {fixture.y_mm.toFixed(0)} mm
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {fixture.note}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {clearanceResult ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0c1020] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldAlert className="h-4 w-4 text-amber-300" /> Clearance
                  Check
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <MetricCard
                    label="Checked Fixtures"
                    value={`${clearanceResult.checked}`}
                  />
                  <MetricCard
                    label="Violations"
                    value={`${clearanceResult.violations.length}`}
                  />
                  <MetricCard
                    label="MEP Ready"
                    value={
                      clearanceResult.violations.length === 0 ? "Yes" : "Review"
                    }
                  />
                </div>
                {clearanceResult.violations.length ? (
                  <div className="mt-4 space-y-2 text-sm text-slate-200">
                    {clearanceResult.violations.map((violation, index) => (
                      <div
                        key={`${violation.a_id}-${violation.b_id}-${index}`}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 p-3"
                      >
                        {violation.a_id} vs {violation.b_id}:{" "}
                        {violation.clearance_mm.toFixed(1)} mm clearance,
                        minimum {violation.min_required_mm.toFixed(1)} mm
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {flowResult ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0c1020] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <Zap className="h-4 w-4 text-yellow-300" /> Pressure / Flow
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard
                    label="Velocity"
                    value={`${flowResult.velocity_mps.toFixed(2)} m/s`}
                  />
                  <MetricCard
                    label="Pressure Drop"
                    value={`${flowResult.pressure_drop_kpa.toFixed(2)} kPa`}
                  />
                  <MetricCard label="Status" value={flowResult.status} />
                  <MetricCard
                    label="Diameter"
                    value={`${flowResult.pipe_diameter_mm.toFixed(0)} mm`}
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  {flowResult.notes.map((note) => (
                    <div
                      key={note}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            id="electrical"
            title="Electrical Templates"
            description="Layouts were previously symmetric because the engine used room center (50%/50%) for many presets. Building type, teaching wall, and corridor bias now shift grids per NBC / IS references (conceptual). Pick building + space type and Electrical discipline for Indian institutional presets."
            icon={Zap}
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Template Inputs
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Building Type"
                    value={electricalForm.building_type}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        building_type:
                          value as ElectricalTemplateForm["building_type"],
                      }))
                    }
                    options={[
                      { label: "College", value: "college" },
                      { label: "School", value: "school" },
                      { label: "University", value: "university" },
                      { label: "Hospital", value: "hospital" },
                      { label: "Commercial Complex", value: "commercial_complex" },
                      { label: "Mall", value: "mall" },
                      { label: "Government Office", value: "government_office" },
                      { label: "Private Office", value: "private_office" },
                      {
                        label: "Residential High Rise",
                        value: "residential_high_rise",
                      },
                    ]}
                  />
                  <SelectField
                    label="MEP Discipline"
                    value={electricalForm.mep_discipline}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        mep_discipline:
                          value as ElectricalTemplateForm["mep_discipline"],
                      }))
                    }
                    options={[
                      { label: "Electrical", value: "electrical" },
                      { label: "Sewage", value: "sewage" },
                      {
                        label: "Fire Fighting Pipeline",
                        value: "fire_fighting_pipeline",
                      },
                      { label: "Fire Alarm", value: "fire_alarm" },
                      { label: "HVAC", value: "hvac" },
                    ]}
                  />
                  <SelectField
                    label="Room / Space Type"
                    value={electricalForm.room_type}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        room_type: value as ElectricalTemplateForm["room_type"],
                      }))
                    }
                    options={[
                      { label: "Classroom", value: "classroom" },
                      { label: "Corridor", value: "corridor" },
                      { label: "Staff Room", value: "staff_room" },
                      { label: "Principal Office", value: "principal_office" },
                      { label: "Meeting Room", value: "meeting_room" },
                      { label: "Library", value: "library" },
                      { label: "Auditorium", value: "auditorium" },
                      { label: "Washroom", value: "washroom" },
                      { label: "Lab (general)", value: "lab" },
                      { label: "Chemistry Lab", value: "chemistry_lab" },
                      { label: "Physics Lab", value: "physics_lab" },
                      { label: "Computer Lab", value: "computer_lab" },
                      { label: "Reception", value: "reception" },
                      { label: "ICU", value: "icu" },
                      { label: "Emergency Ward", value: "emergency_ward" },
                      {
                        label: "Patient Waiting Area",
                        value: "patient_waiting",
                      },
                      {
                        label: "Blood Collection Lab",
                        value: "blood_collection_lab",
                      },
                      { label: "Operation Theatre", value: "operation_theatre" },
                    ]}
                  />
                  <SelectField
                    label="Units"
                    value={electricalUnits}
                    onChange={(value) =>
                      setElectricalUnits(value as "mm" | "imperial")
                    }
                    options={[
                      { label: "Feet / Inches", value: "imperial" },
                      { label: "Millimeters", value: "mm" },
                    ]}
                  />
                  <label className="space-y-1 text-sm">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Room Name
                    </span>
                    <input
                      type="text"
                      value={electricalForm.room_name}
                      onChange={(e) =>
                        setElectricalForm((prev) => ({
                          ...prev,
                          room_name: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                    />
                  </label>
                  <SelectField
                    label="Detected Room"
                    value={electricalForm.room_id || ""}
                    onChange={(value) => {
                      const room = electricalRooms.find(
                        (item) => item.id === value,
                      );
                      setElectricalForm((prev) => ({
                        ...prev,
                        room_id: value || undefined,
                        room_name: room?.name || prev.room_name,
                        room_width_mm: room?.width_mm || prev.room_width_mm,
                        room_depth_mm: room?.depth_mm || prev.room_depth_mm,
                        occupancy: Math.max(
                          prev.occupancy,
                          Math.max(1, Math.round((room?.area_m2 || 0) / 1.2)),
                        ),
                      }));
                    }}
                    options={[
                      {
                        label: electricalRooms.length
                          ? "Choose a saved room"
                          : "No rooms detected yet",
                        value: "",
                      },
                      ...electricalRooms.map((room) => ({
                        label: `${room.name} (${formatImperial(room.width_mm)} x ${formatImperial(room.depth_mm)})`,
                        value: room.id,
                      })),
                    ]}
                  />
                  <MeasurementField
                    label="Room Width"
                    valueMm={electricalForm.room_width_mm}
                    onChangeMm={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        room_width_mm: value,
                      }))
                    }
                    unitMode={electricalUnits}
                    minMm={1}
                    helper={`${formatImperial(electricalForm.room_width_mm)} (stored as mm)`}
                  />
                  <MeasurementField
                    label="Room Depth"
                    valueMm={electricalForm.room_depth_mm}
                    onChangeMm={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        room_depth_mm: value,
                      }))
                    }
                    unitMode={electricalUnits}
                    minMm={1}
                    helper={`${formatImperial(electricalForm.room_depth_mm)} (stored as mm)`}
                  />
                  <MeasurementField
                    label="Ceiling Height"
                    valueMm={electricalForm.ceiling_height_mm}
                    onChangeMm={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        ceiling_height_mm: value,
                      }))
                    }
                    unitMode={electricalUnits}
                    minMm={2400}
                    helper={`${formatImperial(electricalForm.ceiling_height_mm)} (stored as mm)`}
                  />
                  <NumberField
                    label="Occupancy"
                    value={electricalForm.occupancy}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        occupancy: value,
                      }))
                    }
                    min={0}
                  />
                  <SelectField
                    label="Entry Side"
                    value={electricalForm.entry_side}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        entry_side:
                          value as ElectricalTemplateForm["entry_side"],
                      }))
                    }
                    options={[
                      { label: "North", value: "north" },
                      { label: "South", value: "south" },
                      { label: "East", value: "east" },
                      { label: "West", value: "west" },
                    ]}
                  />
                  <SelectField
                    label="Teaching wall (classroom bias)"
                    value={electricalForm.teaching_wall_side}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        teaching_wall_side:
                          value as ElectricalTemplateForm["teaching_wall_side"],
                      }))
                    }
                    options={[
                      {
                        label: "Not specified (symmetric grid)",
                        value: "",
                      },
                      { label: "North", value: "north" },
                      { label: "South", value: "south" },
                      { label: "East", value: "east" },
                      { label: "West", value: "west" },
                    ]}
                  />
                  <MeasurementField
                    label="Stage Depth"
                    valueMm={electricalForm.stage_depth_mm}
                    onChangeMm={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        stage_depth_mm: value,
                      }))
                    }
                    unitMode={electricalUnits}
                    minMm={0}
                    helper={`${formatImperial(electricalForm.stage_depth_mm)} (stored as mm)`}
                  />
                  <NumberField
                    label="Seating Rows"
                    value={electricalForm.seating_rows}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        seating_rows: value,
                      }))
                    }
                    min={0}
                  />
                  <NumberField
                    label="Preferred Voltage (V)"
                    value={electricalForm.preferred_voltage_v}
                    onChange={(value) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        preferred_voltage_v: value,
                      }))
                    }
                    min={110}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleField
                    label="Include emergency circuit"
                    checked={electricalForm.include_emergency_circuit}
                    onChange={(checked) =>
                      setElectricalForm((prev) => ({
                        ...prev,
                        include_emergency_circuit: checked,
                      }))
                    }
                  />
                </div>
                <button
                  onClick={runElectricalTemplate}
                  disabled={
                    electricalBusy ||
                    electricalForm.mep_discipline !== "electrical"
                  }
                  className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {electricalBusy
                    ? "Generating..."
                    : electricalForm.mep_discipline !== "electrical"
                      ? "Select Electrical discipline"
                      : "Generate Electrical Template"}
                </button>
                <button
                  onClick={applyElectricalTemplateToDrawing}
                  disabled={electricalBusy || !electricalResult}
                  className="rounded-xl border border-amber-500/30 bg-white/5 px-5 py-3 text-sm font-bold text-amber-200 transition hover:border-amber-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply to Drawing
                </button>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1020] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Template Preview
                </h3>
                {electricalResult ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                      <MetricCard
                        label="Template"
                        value={electricalResult.template_id}
                      />
                      <MetricCard
                        label="Fixtures"
                        value={`${electricalResult.summary.fixtures}`}
                      />
                      <MetricCard
                        label="Circuits"
                        value={`${electricalResult.summary.circuits}`}
                      />
                      <MetricCard
                        label="Lights"
                        value={`${electricalResult.summary.light_points}`}
                      />
                      <MetricCard
                        label="Sockets"
                        value={`${electricalResult.summary.socket_points}`}
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {electricalResult.rules_used.map((rule) => (
                        <div
                          key={rule}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
                        >
                          {rule}
                        </div>
                      ))}
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Fixture</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">X</th>
                            <th className="px-4 py-3">Y</th>
                            <th className="px-4 py-3">Circuit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-[#0c1020] text-slate-200">
                          {electricalResult.fixtures.map((fixture) => (
                            <tr key={fixture.id}>
                              <td className="px-4 py-3">{fixture.id}</td>
                              <td className="px-4 py-3">{fixture.type}</td>
                              <td className="px-4 py-3">
                                {fixture.x_mm.toFixed(0)} mm
                              </td>
                              <td className="px-4 py-3">
                                {fixture.y_mm.toFixed(0)} mm
                              </td>
                              <td className="px-4 py-3">
                                {fixture.circuit_id}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Circuit</th>
                            <th className="px-4 py-3">Breaker</th>
                            <th className="px-4 py-3">Load</th>
                            <th className="px-4 py-3">Length</th>
                            <th className="px-4 py-3">Route Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-[#0c1020] text-slate-200">
                          {electricalResult.circuits.map((circuit) => (
                            <tr key={circuit.id}>
                              <td className="px-4 py-3">{circuit.label}</td>
                              <td className="px-4 py-3">{circuit.breaker}</td>
                              <td className="px-4 py-3">{circuit.load_type}</td>
                              <td className="px-4 py-3">
                                {circuit.length_mm.toFixed(0)} mm
                              </td>
                              <td className="px-4 py-3">
                                {circuit.route.length}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      {electricalResult.manual_edit_hints.map((hint) => (
                        <div
                          key={hint}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100"
                        >
                          {hint}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    Generate a template to preview the electrical fixtures and
                    circuit routes for the selected room type.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="energy"
            title="Energy / Sustainability"
            description="Estimate cooling load, solar heat gain, daylight score, and an initial energy rating from the project shell or custom assumptions."
            icon={SunMedium}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <NumberField
                label="Floor Area (m²)"
                value={energyForm.floor_area_m2}
                onChange={(value) =>
                  setEnergyForm((prev) => ({ ...prev, floor_area_m2: value }))
                }
                step={0.1}
                min={0}
              />
              <NumberField
                label="Wall Area (m²)"
                value={energyForm.wall_area_m2}
                onChange={(value) =>
                  setEnergyForm((prev) => ({ ...prev, wall_area_m2: value }))
                }
                step={0.1}
                min={0}
              />
              <NumberField
                label="Window Area (m²)"
                value={energyForm.window_area_m2}
                onChange={(value) =>
                  setEnergyForm((prev) => ({ ...prev, window_area_m2: value }))
                }
                step={0.1}
                min={0}
              />
              <NumberField
                label="Occupancy"
                value={energyForm.occupancy}
                onChange={(value) =>
                  setEnergyForm((prev) => ({ ...prev, occupancy: value }))
                }
                min={0}
              />
              <NumberField
                label="Climate Factor"
                value={energyForm.climate_factor}
                onChange={(value) =>
                  setEnergyForm((prev) => ({ ...prev, climate_factor: value }))
                }
                step={0.1}
                min={0}
              />
              <NumberField
                label="Roof Exposure"
                value={energyForm.roof_exposure}
                onChange={(value) =>
                  setEnergyForm((prev) => ({ ...prev, roof_exposure: value }))
                }
                step={0.1}
                min={0}
              />
              <NumberField
                label="Shading Factor"
                value={energyForm.shading_factor}
                onChange={(value) =>
                  setEnergyForm((prev) => ({ ...prev, shading_factor: value }))
                }
                step={0.1}
                min={0}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={runEnergy}
                disabled={energyBusy}
                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {energyBusy ? "Analyzing..." : "Run Energy Analysis"}
              </button>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400">
                EnergyPlus / Ladybug / OpenStudio inspired workflow
              </span>
            </div>

            {energyResult ? (
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <MetricCard
                  label="Cooling Load"
                  value={`${energyResult.cooling_load_kw.toFixed(2)} kW`}
                />
                <MetricCard
                  label="Solar Gain"
                  value={`${energyResult.solar_heat_gain_kw.toFixed(2)} kW`}
                />
                <MetricCard
                  label="Daylight Score"
                  value={`${energyResult.daylight_score.toFixed(1)}`}
                />
                <MetricCard
                  label="Energy Score"
                  value={`${energyResult.energy_score.toFixed(1)}`}
                />
              </div>
            ) : null}

            {energyResult ? (
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                {energyResult.recommendations.map((recommendation) => (
                  <div
                    key={recommendation}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    {recommendation}
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            id="rendering"
            title="Rendering / Visualization"
            description="Prepare a render preset, inspect materials, and stage a client/presentation view with sun and walkthrough settings."
            icon={Eye}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Quality"
                value={renderForm.quality}
                onChange={(value) =>
                  setRenderForm((prev) => ({
                    ...prev,
                    quality: value as RenderingForm["quality"],
                  }))
                }
                options={[
                  { label: "Draft", value: "draft" },
                  { label: "Client", value: "client" },
                  { label: "Presentation", value: "presentation" },
                ]}
              />
              <ToggleField
                label="Walkthrough"
                checked={renderForm.walkthrough}
                onChange={(checked) =>
                  setRenderForm((prev) => ({ ...prev, walkthrough: checked }))
                }
              />
              <ToggleField
                label="Sun / Shadow Study"
                checked={renderForm.sun_study}
                onChange={(checked) =>
                  setRenderForm((prev) => ({ ...prev, sun_study: checked }))
                }
              />
              <ToggleField
                label="Material Preview"
                checked={renderForm.material_preview}
                onChange={(checked) =>
                  setRenderForm((prev) => ({
                    ...prev,
                    material_preview: checked,
                  }))
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={runRendering}
                disabled={renderBusy}
                className="rounded-xl bg-fuchsia-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {renderBusy ? "Preparing..." : "Build Render Preset"}
              </button>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-400">
                Three.js preview settings and material palette
              </span>
            </div>

            {renderResult ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 p-6 shadow-2xl shadow-black/20">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                        Render Preview
                      </div>
                      <div className="mt-1 text-2xl font-bold text-white capitalize">
                        {renderResult.quality} quality
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        Camera
                      </div>
                      <div className="mt-1 text-sm text-white">
                        {renderResult.camera.distance.toFixed(1)}m distance
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 h-64 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.28),rgba(15,23,42,0.95))] p-6">
                    <div className="flex h-full items-end justify-between gap-4">
                      <div className="max-w-sm">
                        <div className="text-sm font-semibold text-slate-200">
                          Sun / Shadow
                        </div>
                        <p className="mt-2 text-sm text-slate-300">
                          {renderResult.sun_study
                            ? "Sun study enabled with shadow-rich lighting."
                            : "Sun study disabled for a faster draft look."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200 backdrop-blur">
                        Samples: {renderResult.settings.samples}
                        <br />
                        Exposure: {renderResult.settings.exposure.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0c1020] p-5">
                  <div className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">
                    Materials
                  </div>
                  <div className="space-y-3">
                    {renderResult.materials.length ? (
                      renderResult.materials.map((material) => (
                        <div
                          key={material.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="font-semibold text-white">
                            {material.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {material.category || "Uncategorized"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                        No material library items found yet.
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    <div className="font-semibold text-white">Render notes</div>
                    <ul className="mt-3 space-y-2">
                      {renderResult.render_notes.map((note) => (
                        <li key={note} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            id="payment-escrow"
            title="Payment / Escrow Workflow"
            description="Track BOQ completion approvals and trigger payment milestones after engineer + client approval with full audit logging."
            icon={Workflow}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  BOQ Item
                </span>
                <input
                  type="text"
                  value={escrowForm.boq_item_id}
                  onChange={(e) =>
                    setEscrowForm((prev) => ({
                      ...prev,
                      boq_item_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <NumberField
                label="Amount"
                value={escrowForm.amount}
                onChange={(value) =>
                  setEscrowForm((prev) => ({ ...prev, amount: value }))
                }
                min={0}
              />
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Currency
                </span>
                <input
                  type="text"
                  value={escrowForm.currency}
                  onChange={(e) =>
                    setEscrowForm((prev) => ({
                      ...prev,
                      currency: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Actor
                </span>
                <input
                  type="text"
                  value={escrowForm.actor}
                  onChange={(e) =>
                    setEscrowForm((prev) => ({
                      ...prev,
                      actor: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={startEscrow}
                disabled={escrowBusy}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {escrowBusy ? "Saving..." : "Create Milestone"}
              </button>
              <button
                onClick={loadEscrowMilestones}
                className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-600"
              >
                Refresh
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">BOQ</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#0c1020] text-slate-200">
                  {milestones.map((ms) => (
                    <tr key={ms.id}>
                      <td className="px-4 py-3">{ms.boq_item_id}</td>
                      <td className="px-4 py-3">
                        {ms.amount.toFixed(2)} {ms.currency}
                      </td>
                      <td className="px-4 py-3">{ms.payment_status}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button
                          onClick={() => approveEscrow(ms.id, "engineer")}
                          disabled={ms.engineer_approved || escrowBusy}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                        >
                          Engineer Approve
                        </button>
                        <button
                          onClick={() => approveEscrow(ms.id, "client")}
                          disabled={ms.client_approved || escrowBusy}
                          className="rounded-lg bg-fuchsia-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                        >
                          Client Approve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            id="marketplace"
            title="Plugin / API Marketplace"
            description="Register consultant plugins (Python/JavaScript SDK), run in docker-sandbox mode, and generate custom reports."
            icon={Box}
          >
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <label className="space-y-1 text-sm xl:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Plugin Name
                </span>
                <input
                  type="text"
                  value={pluginForm.name}
                  onChange={(e) =>
                    setPluginForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Slug
                </span>
                <input
                  type="text"
                  value={pluginForm.slug}
                  onChange={(e) =>
                    setPluginForm((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <SelectField
                label="SDK"
                value={pluginForm.sdk_type}
                onChange={(value) =>
                  setPluginForm((prev) => ({
                    ...prev,
                    sdk_type: value as PluginForm["sdk_type"],
                  }))
                }
                options={[
                  { label: "Python SDK", value: "python" },
                  { label: "JavaScript SDK", value: "javascript" },
                ]}
              />
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Version
                </span>
                <input
                  type="text"
                  value={pluginForm.version}
                  onChange={(e) =>
                    setPluginForm((prev) => ({
                      ...prev,
                      version: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-1 text-sm xl:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Container Image (optional)
                </span>
                <input
                  type="text"
                  value={pluginForm.container_image}
                  onChange={(e) =>
                    setPluginForm((prev) => ({
                      ...prev,
                      container_image: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={registerPlugin}
                disabled={pluginBusy}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {pluginBusy ? "Working..." : "Register Plugin"}
              </button>
              <button
                onClick={loadPlugins}
                className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-600"
              >
                Refresh
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="text-sm font-bold text-white">
                    {plugin.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {plugin.slug} · {plugin.sdk_type} · {plugin.version}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => runPlugin(plugin.id)}
                      disabled={pluginBusy}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                    >
                      Run Plugin
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {pluginRunOutput ? (
              <pre className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-[#0c1020] p-4 text-xs text-slate-200">
                {JSON.stringify(pluginRunOutput, null, 2)}
              </pre>
            ) : null}
          </SectionCard>

          <SectionCard
            id="admin-security"
            title="Admin + Enterprise Security"
            description="Create organizations, assign roles, grant project-level permissions, issue license keys, and inspect audit trails."
            icon={ShieldAlert}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Organization
                </span>
                <input
                  type="text"
                  value={adminForm.org_name}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      org_name: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  SSO Provider
                </span>
                <input
                  type="text"
                  value={adminForm.sso_provider}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      sso_provider: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-1 text-sm xl:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  SSO Issuer
                </span>
                <input
                  type="text"
                  value={adminForm.sso_issuer}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      sso_issuer: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Member Email
                </span>
                <input
                  type="email"
                  value={adminForm.member_email}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      member_email: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <SelectField
                label="Member Role"
                value={adminForm.member_role}
                onChange={(value) =>
                  setAdminForm((prev) => ({
                    ...prev,
                    member_role: value as AdminForm["member_role"],
                  }))
                }
                options={[
                  { label: "Viewer", value: "viewer" },
                  { label: "Editor", value: "editor" },
                  { label: "Approver", value: "approver" },
                  { label: "Admin", value: "admin" },
                ]}
              />
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Access Email
                </span>
                <input
                  type="email"
                  value={adminForm.access_email}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      access_email: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <SelectField
                label="Project Permission"
                value={adminForm.access_permission}
                onChange={(value) =>
                  setAdminForm((prev) => ({
                    ...prev,
                    access_permission: value as AdminForm["access_permission"],
                  }))
                }
                options={[
                  { label: "Read", value: "read" },
                  { label: "Edit", value: "edit" },
                  { label: "Approve", value: "approve" },
                  { label: "Admin", value: "admin" },
                ]}
              />
              <SelectField
                label="License Plan"
                value={adminForm.plan}
                onChange={(value) =>
                  setAdminForm((prev) => ({
                    ...prev,
                    plan: value as AdminForm["plan"],
                  }))
                }
                options={[
                  { label: "Team", value: "team" },
                  { label: "Business", value: "business" },
                  { label: "Enterprise", value: "enterprise" },
                ]}
              />
              <NumberField
                label="License Days"
                value={adminForm.duration_days}
                onChange={(value) =>
                  setAdminForm((prev) => ({ ...prev, duration_days: value }))
                }
                min={1}
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={setupOrganization}
                disabled={adminBusy}
                className="rounded-xl bg-fuchsia-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
              >
                {adminBusy
                  ? "Configuring..."
                  : "Configure Organization + Access"}
              </button>
              <button
                onClick={loadAuditLogs}
                className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-600"
              >
                Refresh Audit Logs
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Organization"
                value={organization?.name || "Not created"}
              />
              <MetricCard
                label="SSO"
                value={organization?.sso_provider || "keycloak"}
              />
              <MetricCard
                label="License"
                value={String(licenseInfo?.plan || "Not issued")}
              />
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#0c1020] text-slate-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{log.actor}</td>
                      <td className="px-4 py-3">{log.action}</td>
                      <td className="px-4 py-3">{log.entity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
          The module hub stays tied to the current project context, so every
          calculation, route, or render preset can be reopened from the same
          project flow.
        </div>
      </div>
    </main>
  );
}
