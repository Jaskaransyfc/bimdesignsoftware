import {
  AreaScheme,
  Element,
  Room,
  RoomIntelligenceResult,
  RoomValidationIssue,
} from "@/types/modeling";
import { withBimMetadata } from "@/lib/bimData";

type RoomDetectionRequest = {
  elements?: Element[];
  area_scheme?: string;
  persist?: boolean;
  include_model_elements?: boolean;
};

export const isGeneratedRoom = (element: Element) => {
  const metadata = (element as Room).metadata;
  const cb05 =
    metadata?.cb05 && typeof metadata.cb05 === "object" && !Array.isArray(metadata.cb05)
      ? (metadata.cb05 as Record<string, unknown>)
      : {};
  return (
    element.type === "room" &&
    cb05.schema_version === "CB-05" &&
    cb05.generated === true
  );
};

export const stripGeneratedRooms = (elements: Element[]) =>
  elements.filter((element) => !isGeneratedRoom(element));

export const mergeGeneratedRooms = (
  elements: Element[],
  generatedRooms: Room[],
): Element[] => [
  ...stripGeneratedRooms(elements),
  ...generatedRooms.map((room) => withBimMetadata(room) as Room),
];

export const roomIssueElementIds = (issues: RoomValidationIssue[]) =>
  new Set(
    issues
      .map((issue) => issue.room_id || issue.element_id)
      .filter((value): value is string => Boolean(value)),
  );

export const fetchAreaSchemes = async (projectId: string): Promise<AreaScheme[]> => {
  const response = await fetch(`/api/projects/${projectId}/area-schemes`);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.area_schemes) ? data.area_schemes : [];
};

export const recalculateRooms = async (
  projectId: string,
  request: RoomDetectionRequest,
): Promise<RoomIntelligenceResult> => {
  const response = await fetch(`/api/projects/${projectId}/rooms/recalculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      elements: request.elements ? stripGeneratedRooms(request.elements) : undefined,
      area_scheme: request.area_scheme || "usable_area",
      persist: request.persist ?? false,
      include_model_elements: request.include_model_elements ?? false,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Room recalculation failed");
  }
  return response.json();
};
