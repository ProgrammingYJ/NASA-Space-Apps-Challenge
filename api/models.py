import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ComparisonRequest(StrictModel):
    observation_ids: list[Literal["S01", "S02", "S12", "S14"]] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def distinct(self):
        if set(self.observation_ids) not in ({"S01", "S02"}, {"S12", "S14"}):
            raise ValueError("A supported distinct observation pair is required")
        return self


class MassScenarioInput(StrictModel):
    target_id: Literal["sedna", "eris", "makemake", "quaoar", "orcus", "gonggong"]
    density_kg_m3: float = Field(ge=100, le=10000)
    analogue_id: Literal["tethys", "dione", "rhea", "iapetus", "ariel", "umbriel"] | None = None
    include_source_ranges: bool = True


class ObserverExperiment(StrictModel):
    enabled: bool = False
    mode: Literal["catalogue_camera", "black_hole_local"] = "catalogue_camera"
    radial_beta: float = Field(default=0, ge=-0.99, le=0.99)
    emitted_wavelength_nm: float = Field(default=550, ge=0.001, le=1e9)
    cosmological_enabled: bool = True
    gravitational_enabled: bool = False
    emitter_radius_rs: float = Field(default=6, ge=1.01, le=1e6)
    local_observer_radius_rs: float = Field(default=20, ge=1.01, le=1e6)
    local_observer_azimuth_rad: float = Field(default=0, ge=-1e6, le=1e6)


class CameraState(StrictModel):
    position: tuple[float, float, float]
    target: tuple[float, float, float]
    representation_version: Literal["solar-display-v1"] = "solar-display-v1"

    @model_validator(mode="after")
    def bounded(self):
        if (
            math.hypot(*self.position) >= 10000
            or not 0.05 <= math.dist(self.position, self.target) < 10000
        ):
            raise ValueError("Camera exceeds display bounds or view-distance limits")
        return self


class SimulationContext(StrictModel):
    algorithm_version: Literal["jpl-kepler-long-term-v1"]
    source_manifest_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    model_calendar_ms: float = Field(ge=-8640000000000000, le=8640000000000000)
    playback_rate_hours_per_second: Literal[1, 6, 24, 72, 8766, 87660, 876600] = 8766
    playback_paused: Literal[True] = True


class UniverseContext(StrictModel):
    selected_object_id: str = Field(max_length=50)
    model_epoch: str = Field(max_length=40)
    camera: CameraState | None = None
    panel_open: bool = True
    source_manifest_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    orbit_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    show_orbits: bool = True
    timeline_algorithm_version: Literal["display-hermite-v1"] | None = None
    playback_rate_hours_per_second: Literal[1, 6, 24, 72, 8766, 87660, 876600] = 6
    playback_paused: Literal[True] = True
    follow_object_id: str | None = Field(default=None, max_length=50)
    appearance_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    small_body_appearance_manifest_sha256: str | None = Field(
        default=None, pattern=r"^[a-f0-9]{64}$"
    )
    planet_criteria_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    mass_scenarios_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    mass_scenario: MassScenarioInput | None = None
    observer_physics_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    black_holes_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    observer_experiment: ObserverExperiment | None = None
    observer_panel_open: bool | None = None
    selected_black_hole_id: str | None = Field(default=None, max_length=80)
    time_preference: Literal["auto", "ephemeris", "simulation"] | None = None
    extended_solar_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    galaxy_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    show_kuiper_belt: bool = False
    show_galaxies: bool = False
    kuiper_display_version: Literal["kuiper-region-v1"] | None = None
    simulation_context: SimulationContext | None = None

    @model_validator(mode="after")
    def consistent_time_preference(self):
        if self.mass_scenario is not None and self.mass_scenarios_manifest_sha256 is None:
            raise ValueError("Mass hypotheses require a source manifest hash")
        if self.observer_experiment is not None and self.observer_physics_manifest_sha256 is None:
            raise ValueError("Observer hypotheses require a source manifest hash")
        if self.selected_black_hole_id is not None and self.black_holes_manifest_sha256 is None:
            raise ValueError("Black-hole selections require a source manifest hash")
        if self.time_preference == "ephemeris" and self.simulation_context is not None:
            raise ValueError("Ephemeris-only preference cannot carry fitted-model time")
        if self.time_preference == "simulation" and self.simulation_context is None:
            raise ValueError("Fitted-model preference requires fitted-model time")
        return self


class Session(StrictModel):
    object_id: Literal["epsilon-indi-b", "pluto"] = "epsilon-indi-b"
    observation_ids: list[Literal["S01", "S02", "S12", "S14"]] = Field(min_length=2, max_length=2)
    active_frame: Literal["A", "B"] = "A"
    view_mode: Literal["split", "blink"] = "split"
    contrast: float = Field(default=1, ge=0.1, le=10)
    locale: Literal["ko", "en", "ja", "zh-Hant", "fr"] = "ko"
    universe_context: UniverseContext | None = None

    @model_validator(mode="after")
    def matching_object(self):
        expected = {"S01", "S02"} if self.object_id == "epsilon-indi-b" else {"S12", "S14"}
        if set(self.observation_ids) != expected:
            raise ValueError("Observation pair must belong to selected object")
        if self.universe_context and self.universe_context.selected_object_id != self.object_id:
            raise ValueError("Exploration context must belong to selected object")
        if self.universe_context and self.universe_context.follow_object_id not in (
            None,
            self.object_id,
        ):
            raise ValueError("Following object must belong to selected context")
        return self


class EvidenceRequest(StrictModel):
    result_id: str = Field(pattern=r"^cmp_[a-f0-9]{24}$")
    session: Session
    judgment: str = Field(max_length=8000)


class Evidence(StrictModel):
    schema_version: Literal["1.0"]
    evidence_id: str = Field(pattern=r"^ev_[a-f0-9]{32}$")
    created_at: str = Field(max_length=64)
    result_id: str = Field(pattern=r"^cmp_[a-f0-9]{24}$")
    session: Session
    judgment: str = Field(max_length=8000)
    comparison: dict
    comparison_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    ai_assistance: str

    @field_validator("comparison")
    @classmethod
    def comparison_shape(cls, value):
        ComparisonManifest.model_validate(value)
        return value


class SourceReference(BaseModel):
    id: str = Field(max_length=20)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class FrameReference(BaseModel):
    observation_id: Literal["S01", "S02", "S12", "S14"]
    provenance: SourceReference
    calibration: SourceReference
    metadata: dict
    prediction: dict
    cutout: dict
    quality: dict


class ComparisonManifest(BaseModel):
    schema_version: Literal["1.0"]
    result_id: str = Field(pattern=r"^cmp_[a-f0-9]{24}$")
    algorithm_version: str = Field(max_length=100)
    object_id: Literal["epsilon-indi-b", "pluto"]
    scientific_status: str = Field(max_length=100)
    mask_policy_id: str = Field(max_length=100)
    frames: list[FrameReference] = Field(min_length=2, max_length=2)
