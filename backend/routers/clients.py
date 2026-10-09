from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import auth
import models
import schemas
from common import search_filter
from database import get_db

router = APIRouter(prefix="/clients", tags=["Clientes"])


def _get_or_404(db: Session, client_id: str) -> models.Client:
    client = db.get(models.Client, client_id.strip().upper())
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return client


@router.get("", response_model=List[schemas.ClientResponse])
def list_clients(
    search: Optional[str] = Query(None, description="Buscar por cédula, nombre o apellido"),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Client)
    if search:
        query = query.filter(search_filter(
            search,
            models.Client.client_id,
            models.Client.name + " " + models.Client.lastname,
        ))
    return query.order_by(models.Client.name, models.Client.lastname).limit(limit).all()


@router.get("/{client_id}", response_model=schemas.ClientResponse)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _get_or_404(db, client_id)


@router.post("", response_model=schemas.ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_data: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if db.get(models.Client, client_data.client_id):
        raise HTTPException(status_code=400, detail="Ya existe un cliente con este documento/cédula.")

    new_client = models.Client(**client_data.model_dump())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client


@router.put("/{client_id}", response_model=schemas.ClientResponse)
def update_client(
    client_id: str,
    data: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    client = _get_or_404(db, client_id)
    changes = data.model_dump(exclude_unset=True)
    for field in ("name", "lastname"):
        if field in changes and changes[field] is None:
            changes.pop(field)
    for key, value in changes.items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    client = _get_or_404(db, client_id)
    if db.query(models.Bill).filter(models.Bill.client_id == client.client_id).first():
        raise HTTPException(status_code=400, detail="No se puede eliminar: el cliente tiene facturas registradas.")
    db.delete(client)
    db.commit()
