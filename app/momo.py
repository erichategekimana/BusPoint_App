"""MTN MoMo Collections API client (Sandbox & Production)."""

from __future__ import annotations

import uuid
from base64 import b64encode

import requests
from flask import current_app


def _cfg(key: str) -> str:
    return current_app.config.get(key, "")


def _basic_token() -> str:
    """Base64-encode API_USER:API_KEY for the /token endpoint."""
    raw = f"{_cfg('MOMO_API_USER')}:{_cfg('MOMO_API_KEY')}"
    return b64encode(raw.encode()).decode()


def get_access_token() -> str:
    """POST /collection/token/ → access_token (valid ~3600 s)."""
    url = f"{_cfg('MOMO_BASE_URL')}/collection/token/"
    resp = requests.post(
        url,
        headers={
            "Authorization": f"Basic {_basic_token()}",
            "Ocp-Apim-Subscription-Key": _cfg("MOMO_SUBSCRIPTION_KEY"),
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def request_to_pay(
    amount: float,
    currency: str | None,
    phone_number: str,
    payer_message: str = "BusPoint ticket payment",
    payee_note: str = "BusPoint",
) -> str:
    """
    Initiate a MoMo Request-to-Pay.

    Returns the X-Reference-Id (UUID) used to track the transaction.
    """
    token = get_access_token()
    reference_id = str(uuid.uuid4())
    currency = currency or _cfg("MOMO_CURRENCY") or "EUR"

    url = f"{_cfg('MOMO_BASE_URL')}/collection/v1_0/requesttopay"
    resp = requests.post(
        url,
        json={
            "amount": str(amount),
            "currency": currency,
            "externalId": reference_id,
            "payer": {"partyIdType": "MSISDN", "partyId": phone_number},
            "payerMessage": payer_message,
            "payeeNote": payee_note,
        },
        headers={
            "Authorization": f"Bearer {token}",
            "X-Reference-Id": reference_id,
            "X-Target-Environment": _cfg("MOMO_ENVIRONMENT") or "sandbox",
            "Ocp-Apim-Subscription-Key": _cfg("MOMO_SUBSCRIPTION_KEY"),
            "Content-Type": "application/json",
        },
        timeout=30,
    )
    resp.raise_for_status()  # 202 Accepted on success
    return reference_id


def get_payment_status(reference_id: str) -> dict:
    """
    GET /collection/v1_0/requesttopay/{referenceId}

    Returns dict with at least: {"status": "PENDING"|"SUCCESSFUL"|"FAILED", ...}
    """
    token = get_access_token()
    url = f"{_cfg('MOMO_BASE_URL')}/collection/v1_0/requesttopay/{reference_id}"
    resp = requests.get(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Target-Environment": _cfg("MOMO_ENVIRONMENT") or "sandbox",
            "Ocp-Apim-Subscription-Key": _cfg("MOMO_SUBSCRIPTION_KEY"),
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()
