from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime

class UserRegistrationSchema(BaseModel):
    fullname: str = Field(..., min_length=2, max_lenght=100)
    phone_number: str = Field(..., min_length=10, max_lenght=15)
    password: str = Field(..., min_lenght=6)
    email: Optional[str] = None


class UserLoginSchema(BaseModel):
    phone_number: str = Field(..., min_lenght=10, max_lenght=15)
    password: str = Field(...)

class UserUpdateSchema(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[str] = None


class PasswordChangeSchema(BaseModel):
    old_password: str = Field(...)
    new_password: str = Field(..., min_length=6)

class TripSearchSchema(BaseModel):
    origin_id: str = Field(..., description="UUID of the starting stop")
    dest_id: str = Field(..., description="UUID of the destination stop")
    date: date = Field(..., description="Travel date in YYYY-MM-DD format")


class TripCreateSchema(BaseModel):
    bus_id: UUID = Field(...)
    route_id: UUID = Field(...)
    departure_time: datetime = Field(..., description="ISO Format: YYYY-MM-DDTHH:MM:SS")
    price: float = Field(..., gt=0)


class BookingCreateSchema(BaseModel):
    trip_id: UUID = Field(..., description="The ID of the trip being booked")
    seat_number: int = Field(..., gt=0, le=60, description="Seat number between 1 and 60")
    pickup_stop_id: UUID = Field(..., description="The stop where the passenger will board")
    dropoff_stop_id: UUID = Field(..., description="The stop where the passenger will alight")

class StopCreateSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    latitude: float = Field(...)
    longitude: float = Field(...)


class NearbySearchSchema(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=2.0, gt=0, le=20)



class BusCreateSchema(BaseModel):
    plate_number: str = Field(..., min_length=7, max_length=10, description="Format: RAE 123A")
    capacity: int = Field(..., gt=0, le=70, description="Seating capacity (max 70)")
    model_info: str = Field(default="Standard Coach", max_length=50)



class RouteCreateSchema(BaseModel):
    name: str = Field(..., min_length=3, max_length=100, description="Example: Kimironko - Nyabugogo")

class RouteStopSchema(BaseModel):
    stop_id: UUID = Field(...)
    stop_order: int = Field(..., gt=0, description="The sequence number (1, 2, 3...)")
    estimated_minutes_from_start: int = Field(..., ge=0, description="Time from the first stop")



class BusLocationUpdateSchema(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)



class NotificationCreateSchema(BaseModel):
    user_id: UUID = Field(...)
    title: str = Field(..., min_length=3, max_length=255)
    message: str = Field(..., min_length=1)
    notification_type: str = Field(default="info", description="e.g., info, alert, success")



class PaymentInitializeSchema(BaseModel):
    booking_id: UUID = Field(...)
    phone_number: str = Field(..., min_length=10, description="The MoMo number to be charged")








