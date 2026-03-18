from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date

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