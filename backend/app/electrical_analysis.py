import math
import logging
from typing import Any, Dict, List

try:
    import opendssdirect as dss
    HAS_OPENDSS = True
except ImportError:
    HAS_OPENDSS = False

logger = logging.getLogger(__name__)

def run_electrical_analysis(
    fixtures: List[Dict[str, Any]], 
    circuits: List[Dict[str, Any]], 
    base_voltage: float = 230.0
) -> Dict[str, Any]:
    """
    Simulates the electrical circuit using OpenDSS.
    Maps BIM fixtures and routes to DSS Buses, Lines, and Loads.
    """
    if not HAS_OPENDSS:
        return _generate_fallback_results(fixtures, circuits, base_voltage)

    try:
        dss.Basic.ClearAll()
        
        # 1. Define Circuit (Source at DB)
        # We assume the first point of the first circuit route is the DB
        dss.Text.Command(f"new circuit.BIM_System basekv={base_voltage/1000.0} phases=1")
        
        # 2. Define Line Geometry / Wire Type
        # Standard copper wire approx properties
        dss.Text.Command("new linecode.wire1 nphases=1 R1=0.01 X1=0.001 units=m")

        # 3. Define Buses and Lines based on routes
        # We create a simple radial system where each fixture is a load on a bus
        # and lines connect them based on the route segments
        
        processed_fixtures = []
        circuit_summaries = []

        for ckt in circuits:
            ckt_id = ckt["id"]
            route = ckt["route"]
            if not route:
                continue

            # Add buses for each point in the route
            for i, pt in enumerate(route):
                bus_name = f"bus_{ckt_id}_{i}"
                if i == 0:
                    # Connect first bus to source (SourceBus)
                    dss.Text.Command(f"new line.L_source_{ckt_id} bus1=SourceBus bus2={bus_name} length=0.001 linecode=wire1")
                else:
                    prev_bus = f"bus_{ckt_id}_{i-1}"
                    # Calculate length between route points
                    dist_mm = math.hypot(pt["x"] - route[i-1]["x"], pt["y"] - route[i-1]["y"])
                    dist_m = max(dist_mm / 1000.0, 0.1) # Min 10cm
                    dss.Text.Command(f"new line.L_{ckt_id}_{i} bus1={prev_bus} bus2={bus_name} length={dist_m} linecode=wire1")

            # Map fixtures on this circuit to the nearest route point
            ckt_fixtures = [f for f in fixtures if f.get("circuit_id") == ckt_id]
            for f in ckt_fixtures:
                f_id = f["id"]
                # Find nearest route point index
                best_idx = 0
                min_dist = float('inf')
                for i, pt in enumerate(route):
                    d = math.hypot(f["x_mm"] - pt["x"], f["y_mm"] - pt["y"])
                    if d < min_dist:
                        min_dist = d
                        best_idx = i
                
                target_bus = f"bus_{ckt_id}_{best_idx}"
                
                # Define Load based on type
                kw = 0.05 # Default 50W (Light)
                if f["type"] == "socket": kw = 0.2 # 200W
                elif f["type"] == "stage_light": kw = 0.5 # 500W
                
                dss.Text.Command(f"new load.LD_{f_id} bus1={target_bus} phases=1 kv={base_voltage/1000.0} kw={kw} pf=0.95")

        # 4. Solve
        dss.Text.Command("solve")

        # 5. Extract Results
        # Extract per-fixture voltage
        for f in fixtures:
            f_id = f["id"]
            # Get bus for this load
            try:
                dss.Loads.Name(f"LD_{f_id}")
                bus_name = dss.CktElement.BusNames()[0].split(".")[0]
                dss.Circuit.SetActiveBus(bus_name)
                v_pu = dss.Bus.puVmagAngle()[0]
                v_actual = v_pu * base_voltage
                
                processed_fixtures.append({
                    "id": f_id,
                    "voltage_v": round(v_actual, 2),
                    "voltage_pu": round(v_pu, 4),
                    "status": "healthy" if v_pu > 0.95 else "warning" if v_pu > 0.9 else "critical"
                })
            except:
                processed_fixtures.append({"id": f_id, "voltage_v": base_voltage, "status": "unknown"})

        # Circuit summaries
        for ckt in circuits:
            ckt_id = ckt["id"]
            # Rough estimate of losses/load for the circuit
            circuit_summaries.append({
                "id": ckt_id,
                "peak_load_kw": round(sum(0.2 if f["type"]=="socket" else 0.05 for f in fixtures if f.get("circuit_id") == ckt_id), 2),
                "voltage_drop_max_pct": round((1.0 - min([pf["voltage_pu"] for pf in processed_fixtures if any(f["id"] == pf["id"] for f in fixtures if f.get("circuit_id") == ckt_id)] or [1.0])) * 100, 2)
            })

        return {
            "engine": "OpenDSS",
            "status": "success",
            "fixtures": processed_fixtures,
            "circuits": circuit_summaries,
            "overall_health": "good" if all(f["status"] == "healthy" for f in processed_fixtures) else "check_required"
        }

    except Exception as e:
        logger.error(f"OpenDSS simulation failed: {e}")
        return _generate_fallback_results(fixtures, circuits, base_voltage, error=str(e))

def _generate_fallback_results(fixtures, circuits, base_voltage, error=None) -> Dict[str, Any]:
    """Generates heuristic-based results if OpenDSS is unavailable."""
    processed_fixtures = []
    for f in fixtures:
        # Heuristic: 0.5V drop per 10m approx
        dist_from_origin = math.hypot(f["x_mm"], f["y_mm"]) / 1000.0
        v_drop = (dist_from_origin / 20.0) * (2.0 if f["type"] == "socket" else 0.5)
        v_actual = base_voltage - v_drop
        processed_fixtures.append({
            "id": f["id"],
            "voltage_v": round(v_actual, 2),
            "voltage_pu": round(v_actual / base_voltage, 4),
            "status": "healthy" if v_actual / base_voltage > 0.97 else "warning"
        })
    
    return {
        "engine": "Heuristic (OpenDSS Unavailable)",
        "status": "partial",
        "error": error,
        "fixtures": processed_fixtures,
        "circuits": [{"id": c["id"], "voltage_drop_max_pct": 1.5} for c in circuits],
        "overall_health": "simulated"
    }
