"""Datasets sub-client.

Lists the medical/condition reference datasets the engine consults.
Each dataset has a stable id and a versioned snapshot timestamp; the
caller pins their workflow to a specific dataset id to get
reproducible underwriting decisions across releases.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from ..core.json_response import dataset_items_from_body, inner_data_object


class Dataset(BaseModel):
    """A reference dataset descriptor."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    id: str
    name: str = ""
    version: str = ""
    description: str = ""
    record_count: int = Field(default=0, alias="record_count")


def parse_dataset_list(body: str) -> tuple[Dataset, ...]:
    items = dataset_items_from_body(body)
    return tuple(Dataset.model_validate(item) for item in items)


def parse_dataset(body: str) -> Dataset:
    inner = inner_data_object(body, context="datasets.get")
    return Dataset.model_validate(inner)
