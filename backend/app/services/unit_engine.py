from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any


@dataclass(frozen=True)
class UnitDefinition:
    code: str
    quantity_type: str
    internal_unit: str
    factor_to_internal: Decimal
    aliases: tuple[str, ...] = ()


class UnitConversionService:
    """Canonical BIM unit engine.

    Internal storage is always canonical:
    - length: meter
    - area: square meter
    - volume: cubic meter
    - pressure: pascal
    - power: watt
    - force: newton
    """

    _units: dict[str, UnitDefinition] = {
        "mm": UnitDefinition("mm", "length", "m", Decimal("0.001"), ("millimeter", "millimeters")),
        "cm": UnitDefinition("cm", "length", "m", Decimal("0.01"), ("centimeter", "centimeters")),
        "m": UnitDefinition("m", "length", "m", Decimal("1"), ("meter", "meters")),
        "in": UnitDefinition("in", "length", "m", Decimal("0.0254"), ("inch", "inches", '"')),
        "ft": UnitDefinition("ft", "length", "m", Decimal("0.3048"), ("feet", "foot", "'")),
        "sq.m": UnitDefinition("sq.m", "area", "sq.m", Decimal("1"), ("m2", "sqm", "square meter", "square meters")),
        "sq.ft": UnitDefinition("sq.ft", "area", "sq.m", Decimal("0.09290304"), ("ft2", "sqft", "square feet", "square foot")),
        "cubic_m": UnitDefinition("cubic_m", "volume", "cubic_m", Decimal("1"), ("m3", "cu.m", "cubic meter", "cubic meters")),
        "cubic_ft": UnitDefinition("cubic_ft", "volume", "cubic_m", Decimal("0.028316846592"), ("ft3", "cu.ft", "cubic feet", "cubic foot")),
        "Pa": UnitDefinition("Pa", "pressure", "Pa", Decimal("1"), ("pascal", "pascals")),
        "kPa": UnitDefinition("kPa", "pressure", "Pa", Decimal("1000"), ("kilopascal", "kilopascals")),
        "W": UnitDefinition("W", "power", "W", Decimal("1"), ("watt", "watts")),
        "kW": UnitDefinition("kW", "power", "W", Decimal("1000"), ("kilowatt", "kilowatts")),
        "N": UnitDefinition("N", "force", "N", Decimal("1"), ("newton", "newtons")),
        "kN": UnitDefinition("kN", "force", "N", Decimal("1000"), ("kilonewton", "kilonewtons")),
    }

    _quantity_defaults = {
        "length": "m",
        "area": "sq.m",
        "volume": "cubic_m",
        "pressure": "Pa",
        "power": "W",
        "force": "N",
    }

    def __init__(self) -> None:
        self._alias_index: dict[str, str] = {}
        for code, definition in self._units.items():
            self._alias_index[self._clean_unit(code)] = code
            for alias in definition.aliases:
                self._alias_index[self._clean_unit(alias)] = code

    def canonical_unit_for(self, quantity_type: str) -> str:
        return self._quantity_defaults.get(quantity_type, quantity_type)

    def supported_units(self) -> list[dict[str, Any]]:
        return [
            {
                "code": unit.code,
                "quantity_type": unit.quantity_type,
                "internal_unit": unit.internal_unit,
                "aliases": list(unit.aliases),
            }
            for unit in self._units.values()
        ]

    def normalize_unit(self, unit: str | None, quantity_type: str | None = None) -> str:
        if not unit:
            if quantity_type:
                return self.canonical_unit_for(quantity_type)
            return "m"
        code = self._alias_index.get(self._clean_unit(unit), unit)
        if code not in self._units:
            raise ValueError(f"Unsupported unit: {unit}")
        definition = self._units[code]
        if quantity_type and definition.quantity_type != quantity_type:
            raise ValueError(
                f"Unit {unit} is a {definition.quantity_type} unit, not {quantity_type}"
            )
        return code

    def convert_to_internal(
        self,
        value: int | float | str | Decimal,
        unit: str | None,
        quantity_type: str | None = None,
    ) -> float:
        code = self.normalize_unit(unit, quantity_type)
        numeric = self._to_decimal(value)
        return float(numeric * self._units[code].factor_to_internal)

    def convert_for_display(
        self,
        value: int | float | str | Decimal,
        display_unit: str | None,
        quantity_type: str | None = None,
    ) -> float:
        code = self.normalize_unit(display_unit, quantity_type)
        numeric = self._to_decimal(value)
        return float(numeric / self._units[code].factor_to_internal)

    def parse_user_input(
        self,
        raw: Any,
        default_unit: str = "m",
        quantity_type: str | None = None,
    ) -> float:
        if isinstance(raw, (int, float, Decimal)):
            return self.convert_to_internal(raw, default_unit, quantity_type)
        text = str(raw).strip()
        if not text:
            raise ValueError("Empty unit input")
        match = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*([A-Za-z.\u00b2\u00b3'\" ]*)\s*$", text)
        if not match:
            raise ValueError(f"Could not parse unit input: {raw}")
        value = match.group(1)
        unit = match.group(2).strip() or default_unit
        unit = unit.replace("²", "2").replace("³", "3")
        return self.convert_to_internal(value, unit, quantity_type)

    def format_display_value(
        self,
        value: int | float | str | Decimal,
        display_unit: str = "m",
        quantity_type: str | None = None,
        precision: int = 3,
    ) -> str:
        converted = Decimal(str(self.convert_for_display(value, display_unit, quantity_type)))
        quant = Decimal("1") if precision <= 0 else Decimal("1").scaleb(-precision)
        rounded = converted.quantize(quant, rounding=ROUND_HALF_UP)
        normalized = f"{rounded:f}".rstrip("0").rstrip(".")
        return f"{normalized} {self.normalize_unit(display_unit, quantity_type)}"

    def _clean_unit(self, unit: str) -> str:
        return unit.strip().lower().replace(" ", "").replace("_", ".")

    def _to_decimal(self, value: int | float | str | Decimal) -> Decimal:
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))


unit_conversion_service = UnitConversionService()

