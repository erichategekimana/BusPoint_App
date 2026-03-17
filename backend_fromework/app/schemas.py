from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegistrationSchema(BaseModel):
    fullname: str = Field(..., min_length=2, max_lenght=100)
    phone_number: str = Field(..., min_length=10, max_lenght=15)
    password: str = Field(..., min_lenght=6)
    email: Optional[str] = None


class UserLoginSchema(BaseModel):
    phone_number: str = Field(..., min_lenght=10, max_lenght=15)
    password: str = Field(...)