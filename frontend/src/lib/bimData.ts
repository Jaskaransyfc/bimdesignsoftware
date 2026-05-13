export type BIMParameterScope = "type" | "instance" | "shared";

export type BIMParameterValue = string | number | boolean | null;

export interface BIMCategoryDefinition {
  code: string;
  name: string;
  discipline: string;
  ifc_class?: string;
  element_types: string[];
  default_visible: boolean;
  schedule_enabled: boolean;
}

export interface BIMSharedParameterDefinition {
  key: string;
  name: string;
  data_type: "string" | "number" | "boolean" | "enum";
  unit_type?: string | null;
  internal_unit?: string | null;
  categories: string[];
  default_value?: BIMParameterValue;
  required?: boolean;
  visible?: boolean;
  validation?: Record<string, unknown> | null;
  ifc_property?: string | null;
}

export interface BIMParameterEnvelope {
  schema_version: "CB-01";
  element_type: string;
  category: string;
  type_parameters: Record<string, BIMParameterValue>;
  instance_parameters: Record<string, BIMParameterValue>;
  shared_parameters: Record<string, BIMParameterValue>;
  parameter_sources?: Record<string, BIMParameterScope>;
}

export interface BIMValidationIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  element_id?: string | null;
  path?: string | null;
}

type BIMMetadata = Record<string, unknown> & {
  cb01?: Record<string, unknown> & {
    category?: string;
    parameters?: Partial<BIMParameterEnvelope>;
  };
};

type BIMParameters = Record<string, unknown> & {
  _cb01?: Partial<BIMParameterEnvelope>;
};

type BIMElementLike = {
  [key: string]: unknown;
  id?: string;
  type?: string;
  levelId?: string | null;
  category?: string;
  metadata?: BIMMetadata;
  parameters?: BIMParameters;
  visible?: boolean;
};

export const CB01_CATEGORIES: BIMCategoryDefinition[] = [
  {
    code: "walls",
    name: "Walls",
    discipline: "architecture",
    ifc_class: "IfcWall",
    element_types: ["wall", "Wall"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "doors",
    name: "Doors",
    discipline: "architecture",
    ifc_class: "IfcDoor",
    element_types: ["door", "Door"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "windows",
    name: "Windows",
    discipline: "architecture",
    ifc_class: "IfcWindow",
    element_types: ["window", "Window"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "slabs",
    name: "Slabs/Floors",
    discipline: "structure",
    ifc_class: "IfcSlab",
    element_types: ["floor", "slab", "Slab"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "ceilings",
    name: "Ceilings/Roofs",
    discipline: "architecture",
    ifc_class: "IfcCovering",
    element_types: ["roof", "ceiling", "Ceiling"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "rooms",
    name: "Rooms",
    discipline: "architecture",
    ifc_class: "IfcSpace",
    element_types: ["room", "Room"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "furniture",
    name: "Furniture",
    discipline: "interiors",
    ifc_class: "IfcFurniture",
    element_types: ["furniture", "Furniture"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "electrical",
    name: "Electrical",
    discipline: "electrical",
    ifc_class: "IfcDistributionElement",
    element_types: ["electrical_fixture", "Electrical"],
    default_visible: true,
    schedule_enabled: true,
  },
  {
    code: "custom",
    name: "Custom",
    discipline: "coordination",
    ifc_class: "IfcBuildingElementProxy",
    element_types: ["custom", "Custom"],
    default_visible: true,
    schedule_enabled: true,
  },
];

export const CB01_SHARED_PARAMETERS: BIMSharedParameterDefinition[] = [
  {
    key: "fire_rating",
    name: "Fire Rating",
    data_type: "string",
    categories: ["walls", "doors", "windows", "slabs", "ceilings"],
    default_value: "-",
    visible: true,
  },
  {
    key: "manufacturer",
    name: "Manufacturer",
    data_type: "string",
    categories: ["doors", "windows", "furniture", "electrical"],
    default_value: "",
    visible: true,
  },
  {
    key: "cost_code",
    name: "Cost Code",
    data_type: "string",
    categories: ["walls", "doors", "windows", "slabs", "ceilings", "rooms", "furniture", "electrical"],
    default_value: "",
    visible: true,
  },
  {
    key: "phase",
    name: "Phase",
    data_type: "enum",
    categories: ["walls", "doors", "windows", "slabs", "ceilings", "rooms", "furniture", "electrical"],
    default_value: "new",
    validation: { allowed_values: ["existing", "new", "demolish", "temporary"] },
    visible: true,
  },
  {
    key: "asset_code",
    name: "Asset Code",
    data_type: "string",
    categories: ["furniture", "electrical"],
    default_value: "",
    visible: true,
  },
  {
    key: "system_type",
    name: "System Type",
    data_type: "string",
    categories: ["electrical"],
    default_value: "",
    visible: true,
  },
];

const MM_FIELDS = new Set(["width", "height", "depth", "thickness", "length"]);

export const lengthToInternalMeters = (value: number, unit: "mm" | "cm" | "m" | "ft" | "in" = "mm") => {
  if (unit === "m") return value;
  if (unit === "cm") return value / 100;
  if (unit === "ft") return value * 0.3048;
  if (unit === "in") return value * 0.0254;
  return value / 1000;
};

export const internalMetersToDisplay = (value: number, unit: "mm" | "cm" | "m" | "ft" | "in" = "mm") => {
  if (unit === "m") return value;
  if (unit === "cm") return value * 100;
  if (unit === "ft") return value / 0.3048;
  if (unit === "in") return value / 0.0254;
  return value * 1000;
};

export const formatBimDisplayValue = (
  value: BIMParameterValue,
  field: string,
  displayUnit: "mm" | "cm" | "m" | "ft" | "in" = "mm",
) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value !== "number") return String(value);
  if (!MM_FIELDS.has(field)) return String(value);
  const converted = internalMetersToDisplay(value, displayUnit);
  const precision = displayUnit === "m" ? 3 : displayUnit === "ft" || displayUnit === "in" ? 2 : 0;
  return `${converted.toFixed(precision)} ${displayUnit}`;
};

const toBimParameterValue = (value: unknown): BIMParameterValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return value === undefined ? null : String(value);
};

export const getElementCategory = (element: object): string => {
  const source = element as BIMElementLike;
  if (source.category) return source.category;
  const metadataCategory = source.metadata?.cb01?.category;
  if (metadataCategory) return metadataCategory;
  const type = String(source.type || "").toLowerCase();
  const category = CB01_CATEGORIES.find((item) =>
    item.element_types.some((candidate) => candidate.toLowerCase() === type),
  );
  return category?.code || "custom";
};

export const getElementTypeName = (element: object) => {
  const source = element as BIMElementLike;
  const type = String(source.type || "custom");
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const getApplicableSharedParameters = (category: string) =>
  CB01_SHARED_PARAMETERS.filter((param) => param.categories.includes(category));

const syncEnvelopeFromEditableFields = (
  source: BIMElementLike,
  envelope: BIMParameterEnvelope,
): BIMParameterEnvelope => {
  const next: BIMParameterEnvelope = {
    ...envelope,
    type_parameters: { ...envelope.type_parameters },
    instance_parameters: { ...envelope.instance_parameters },
    shared_parameters: { ...envelope.shared_parameters },
    parameter_sources: { ...(envelope.parameter_sources || {}) },
  };

  if (source.type === "wall") {
    if (source.thickness !== undefined) {
      next.type_parameters.thickness = lengthToInternalMeters(Number(source.thickness));
    }
    if (source.material !== undefined) {
      next.type_parameters.material = String(source.material);
    }
    if (source.fireRating !== undefined) {
      next.shared_parameters.fire_rating = String(source.fireRating);
    }
    if (source.height !== undefined) {
      next.instance_parameters.height = lengthToInternalMeters(Number(source.height));
    }
  }

  if (source.type === "door") {
    if (source.width !== undefined) {
      next.type_parameters.width = lengthToInternalMeters(Number(source.width));
    }
    if (source.height !== undefined) {
      next.type_parameters.height = lengthToInternalMeters(Number(source.height));
    }
    if (source.thickness !== undefined) {
      next.type_parameters.thickness = lengthToInternalMeters(Number(source.thickness));
    } else if (next.type_parameters.thickness === undefined) {
      next.type_parameters.thickness = 0.12;
    }
    if (source.material !== undefined) {
      next.type_parameters.material = String(source.material);
    }
    if (source.fireRating !== undefined) {
      next.shared_parameters.fire_rating = String(source.fireRating);
    }
    next.instance_parameters.host_wall_id = toBimParameterValue(source.wallId ?? null);
    next.instance_parameters.rotation = Number(source.orientation ?? 0);
  }

  if (source.type === "window") {
    if (source.width !== undefined) {
      next.type_parameters.width = lengthToInternalMeters(Number(source.width));
    }
    if (source.height !== undefined) {
      next.type_parameters.height = lengthToInternalMeters(Number(source.height));
    }
    if (source.thickness !== undefined) {
      next.type_parameters.thickness = lengthToInternalMeters(Number(source.thickness));
    } else if (next.type_parameters.thickness === undefined) {
      next.type_parameters.thickness = 0.12;
    }
    if (source.material !== undefined) {
      next.type_parameters.material = String(source.material);
    }
    if (source.glazing !== undefined) {
      next.type_parameters.glazing = String(source.glazing);
    }
    next.instance_parameters.host_wall_id = toBimParameterValue(source.wallId ?? null);
    next.instance_parameters.rotation = Number(source.orientation ?? 0);
  }

  if (source.type === "floor" || source.type === "roof") {
    if (source.width !== undefined) {
      next.type_parameters.width = lengthToInternalMeters(Number(source.width));
    }
    if (source.depth !== undefined) {
      next.type_parameters.depth = lengthToInternalMeters(Number(source.depth));
    }
    next.instance_parameters.rotation = Number(source.rotation ?? 0);
  }

  if (source.type === "stairs" || source.type === "railing") {
    if (source.width !== undefined || source.length !== undefined) {
      next.type_parameters.width = lengthToInternalMeters(
        Number(source.width ?? source.length ?? 1000),
      );
    }
    if (source.height !== undefined) {
      next.type_parameters.height = lengthToInternalMeters(Number(source.height));
    }
    next.instance_parameters.rotation = Number(source.rotation ?? 0);
  }

  if (source.levelId !== undefined) {
    next.instance_parameters.level_id = source.levelId || null;
  }
  if (source.visible !== undefined) {
    next.instance_parameters.visible = source.visible;
  }

  getApplicableSharedParameters(next.category).forEach((param) => {
    const value = source[param.key] ?? source.metadata?.[param.key];
    if (value !== undefined) {
      next.shared_parameters[param.key] = toBimParameterValue(value);
    }
  });

  return next;
};

export const getBimParameterEnvelope = (
  element: object,
): BIMParameterEnvelope => {
  const source = element as BIMElementLike;
  const category = getElementCategory(source);
  const existing = source.parameters?._cb01 || source.metadata?.cb01?.parameters;
  if (existing?.schema_version === "CB-01") {
    return syncEnvelopeFromEditableFields(source, {
      schema_version: "CB-01",
      element_type: existing.element_type || getElementTypeName(element),
      category: existing.category || category,
      type_parameters: existing.type_parameters || {},
      instance_parameters: existing.instance_parameters || {},
      shared_parameters: existing.shared_parameters || {},
      parameter_sources: existing.parameter_sources || {},
    });
  }

  const typeParameters: Record<string, BIMParameterValue> = {};
  const instanceParameters: Record<string, BIMParameterValue> = {};

  if (source.type === "wall") {
    typeParameters.thickness = lengthToInternalMeters(Number(source.thickness ?? 230));
    typeParameters.material = String(source.material ?? "Standard");
    typeParameters.fire_rating = String(source.fireRating ?? "-");
    instanceParameters.height = lengthToInternalMeters(Number(source.height ?? 3000));
  }
  if (source.type === "door") {
    typeParameters.width = lengthToInternalMeters(Number(source.width ?? 900));
    typeParameters.height = lengthToInternalMeters(Number(source.height ?? 2100));
    typeParameters.thickness = lengthToInternalMeters(Number(source.thickness ?? 120));
    typeParameters.material = String(source.material ?? "Wood");
    typeParameters.fire_rating = String(source.fireRating ?? "-");
    instanceParameters.host_wall_id = toBimParameterValue(source.wallId ?? null);
    instanceParameters.rotation = Number(source.orientation ?? 0);
  }
  if (source.type === "window") {
    typeParameters.width = lengthToInternalMeters(Number(source.width ?? 1200));
    typeParameters.height = lengthToInternalMeters(Number(source.height ?? 1200));
    typeParameters.thickness = lengthToInternalMeters(Number(source.thickness ?? 120));
    typeParameters.material = String(source.material ?? "Aluminum");
    typeParameters.glazing = String(source.glazing ?? "Standard");
    instanceParameters.host_wall_id = toBimParameterValue(source.wallId ?? null);
    instanceParameters.rotation = Number(source.orientation ?? 0);
  }
  if (source.type === "floor" || source.type === "roof") {
    typeParameters.width = lengthToInternalMeters(Number(source.width ?? 3000));
    typeParameters.depth = lengthToInternalMeters(Number(source.depth ?? 3000));
    instanceParameters.rotation = Number(source.rotation ?? 0);
  }
  if (source.type === "stairs" || source.type === "railing") {
    typeParameters.width = lengthToInternalMeters(Number(source.width ?? source.length ?? 1000));
    typeParameters.height = lengthToInternalMeters(Number(source.height ?? 1100));
    instanceParameters.rotation = Number(source.rotation ?? 0);
  }
  if (source.type === "room") {
    const roomProperties = source.properties as { area?: number } | undefined;
    instanceParameters.height = lengthToInternalMeters(Number(source.height ?? 3000));
    instanceParameters.area = roomProperties?.area ?? null;
  }

  instanceParameters.level_id = source.levelId || null;
  instanceParameters.visible = source.visible === false ? false : true;

  const sharedParameters = Object.fromEntries(
    getApplicableSharedParameters(category).map((param) => [
      param.key,
      toBimParameterValue(
        source[param.key] ?? source.metadata?.[param.key] ?? param.default_value ?? null,
      ),
    ]),
  );

  return syncEnvelopeFromEditableFields(source, {
    schema_version: "CB-01",
    element_type: getElementTypeName(element),
    category,
    type_parameters: typeParameters,
    instance_parameters: instanceParameters,
    shared_parameters: sharedParameters,
    parameter_sources: {
      ...Object.fromEntries(Object.keys(typeParameters).map((key) => [key, "type" as const])),
      ...Object.fromEntries(Object.keys(instanceParameters).map((key) => [key, "instance" as const])),
      ...Object.fromEntries(Object.keys(sharedParameters).map((key) => [key, "shared" as const])),
    },
  });
};

export const withBimMetadata = <T extends object>(element: T): T => {
  const source = element as BIMElementLike;
  const category = getElementCategory(source);
  const parameters = getBimParameterEnvelope(source);
  return {
    ...element,
    category,
    visible: source.visible ?? true,
    parameters: {
      ...(source.parameters || {}),
      _cb01: parameters,
      type_parameters: parameters.type_parameters,
      instance_parameters: parameters.instance_parameters,
      shared_parameters: parameters.shared_parameters,
    },
    metadata: {
      ...(source.metadata || {}),
      cb01: {
        ...(source.metadata?.cb01 || {}),
        schema_version: "CB-01",
        object_model: "BIMElement",
        element_type: parameters.element_type,
        category,
        ifc_ready: true,
      },
    },
  } as T;
};

export const applyBimParameterUpdate = <T extends object>(
  element: T,
  scope: BIMParameterScope,
  key: string,
  rawValue: string,
): T => {
  const source = element as BIMElementLike;
  const envelope = getBimParameterEnvelope(source);
  const scopeKey = `${scope}_parameters` as
    | "type_parameters"
    | "instance_parameters"
    | "shared_parameters";
  const previous = envelope[scopeKey][key];
  const nextValue: BIMParameterValue =
    typeof previous === "number" ? Number(rawValue) : rawValue === "true" ? true : rawValue === "false" ? false : rawValue;
  const nextEnvelope = {
    ...envelope,
    [scopeKey]: {
      ...envelope[scopeKey],
      [key]: nextValue,
    },
  } as BIMParameterEnvelope;
  const legacyUpdates: Record<string, unknown> = {};
  if (
    typeof nextValue === "number" &&
    ["width", "height", "depth", "thickness", "length"].includes(key)
  ) {
    legacyUpdates[key] = internalMetersToDisplay(nextValue, "mm");
  }
  if (key === "level_id") {
    legacyUpdates.levelId = typeof nextValue === "string" ? nextValue : undefined;
  }
  if (scope === "shared") {
    legacyUpdates.metadata = {
      ...(source.metadata || {}),
      [key]: nextValue,
    };
  }
  return withBimMetadata({
    ...element,
    ...legacyUpdates,
    parameters: {
      ...(source.parameters || {}),
      _cb01: nextEnvelope,
    },
  } as T);
};

export const validateBimElements = (elements: object[]): BIMValidationIssue[] => {
  const issues: BIMValidationIssue[] = [];
  elements.forEach((element) => {
    const source = element as BIMElementLike;
    const category = getElementCategory(source);
    const envelope = getBimParameterEnvelope(source);
    const id = source.id || null;
    if (!source.metadata?.cb01) {
      issues.push({
        code: "element_metadata_missing",
        severity: "warning",
        element_id: id,
        path: "metadata",
        message: "Element metadata is missing.",
      });
    }
    if (["wall", "door", "window"].includes(String(source.type)) && !source.levelId) {
      issues.push({
        code: "level_missing",
        severity: "warning",
        element_id: id,
        path: "levelId",
        message: "Physical BIM object is not associated with a level.",
      });
    }
    getApplicableSharedParameters(category).forEach((param) => {
      if (param.required && !envelope.shared_parameters[param.key]) {
        issues.push({
          code: "shared_parameter_required",
          severity: "error",
          element_id: id,
          path: `parameters.shared_parameters.${param.key}`,
          message: `${param.name} is required.`,
        });
      }
    });
  });
  return issues;
};
