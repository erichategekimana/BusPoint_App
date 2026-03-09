from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=7, max_length=15)
    email: EmailStr | None = None
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="passenger")

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        allowed = {"passenger", "driver", "admin"}
        role = value.lower().strip()
        if role not in allowed:
            raise ValueError(f"role must be one of {sorted(allowed)}")
        return role


class LoginRequest(BaseModel):
    phone_number: str | None = None
    email: EmailStr | None = None
    password: str = Field(min_length=6, max_length=128)

    @field_validator("password")
    @classmethod
    def not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("password must not be empty")
        return value


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    phone_number: str
    email: str | None
    role: str
    created_at: datetime | None = None


class StopPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    latitude: float
    longitude: float
    is_active: bool


class RouteStopPublic(BaseModel):
    id: UUID
    stop_order: int
    estimated_minutes_from_start: int
    stop: StopPublic


class RoutePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    route_code: str
    name: str
    is_active: bool


class RouteWithStops(RoutePublic):
    stops: list[RouteStopPublic]


class TripPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bus_id: UUID
    route_id: UUID
    departure_time: datetime
    arrival_time: datetime | None
    status: str
    current_capacity: int


class BookingCreateRequest(BaseModel):
    trip_id: UUID
    pickup_stop_id: UUID
    dropoff_stop_id: UUID
    seat_number: int | None = Field(default=None, ge=1)


class BookingPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    trip_id: UUID
    seat_number: int | None
    status: str
    pickup_stop_id: UUID | None
    dropoff_stop_id: UUID | None
    ticket_token: str | None
    created_at: datetime | None = None


class BusLocationUpdateRequest(BaseModel):
    trip_id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed: float | None = None
    heading: float | None = Field(default=None, ge=0, le=360)


class BusLocationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bus_id: UUID
    trip_id: UUID
    latitude: float
    longitude: float
    speed: float | None
    heading: float | None
    last_updated: datetime
