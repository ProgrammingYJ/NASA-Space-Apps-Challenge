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
    playback_rate_hours_per_second: Literal[72, 8766, 87660, 876600] = 8766
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
    playback_rate_hours_per_second: Literal[1, 6, 24, 72] = 6
    playback_paused: Literal[True] = True
    follow_object_id: str | None = Field(default=None, max_length=50)
    appearance_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    extended_solar_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    galaxy_manifest_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    show_kuiper_belt: bool = False
    show_galaxies: bool = False
    kuiper_display_version: Literal["kuiper-region-v1"] | None = None
    simulation_context: SimulationContext | None = None


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
