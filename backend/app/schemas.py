from pydantic import BaseModel, Field

class InsightRequest(BaseModel):
    location: str = "Bengaluru"
    readings: dict = Field(default_factory=dict)
