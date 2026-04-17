import json
import pytest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import lambda_function as lf

# ── Helpers ──────────────────────────────────────────────────────────────────
def make_event(method, path, body=None, token="Bearer testtoken"):
    return {
        "httpMethod": method,
        "path": path,
        "headers": {"Authorization": token},
        "body": json.dumps(body or {})
    }

MOCK_USER = {"userId": "user-123", "role": "user"}

# ── verify_token ──────────────────────────────────────────────────────────────
def test_verify_token_missing():
    event = {"headers": {}}
    user, err = lf.verify_token(event)
    assert user is None
    assert err == "Missing token"

def test_verify_token_invalid():
    event = {"headers": {"Authorization": "Bearer badtoken"}}
    user, err = lf.verify_token(event)
    assert user is None
    assert err == "Invalid token"

# ── initiate_payment ──────────────────────────────────────────────────────────
@patch("lambda_function.payment_table")
@patch("lambda_function.create_razorpay_order")
def test_initiate_payment_success(mock_razorpay, mock_table):
    mock_razorpay.return_value = ({"id": "rz_order_123"}, None)
    mock_table.put_item = MagicMock()

    body = {"order_id": "ord-1", "amount": 500}
    res = lf.initiate_payment(body, MOCK_USER)

    assert res["statusCode"] == 201
    data = json.loads(res["body"])
    assert "payment_id" in data
    assert data["razorpay_order_id"] == "rz_order_123"

@patch("lambda_function.create_razorpay_order")
def test_initiate_payment_missing_fields(mock_razorpay):
    res = lf.initiate_payment({}, MOCK_USER)
    assert res["statusCode"] == 400

@patch("lambda_function.create_razorpay_order")
def test_initiate_payment_zero_amount(mock_razorpay):
    res = lf.initiate_payment({"order_id": "ord-1", "amount": 0}, MOCK_USER)
    assert res["statusCode"] == 400

# ── verify_payment ────────────────────────────────────────────────────────────
@patch("lambda_function.payment_table")
@patch("lambda_function.verify_razorpay_signature")
def test_verify_payment_success(mock_sig, mock_table):
    mock_sig.return_value = True
    mock_table.get_item.return_value = {"Item": {"payment_id": "pay-1", "user_id": "user-123"}}
    mock_table.update_item = MagicMock()

    body = {
        "payment_id": "pay-1",
        "razorpay_order_id": "rz_ord",
        "razorpay_payment_id": "rz_pay",
        "razorpay_signature": "sig"
    }
    res = lf.verify_payment(body, MOCK_USER)
    assert res["statusCode"] == 200

@patch("lambda_function.payment_table")
@patch("lambda_function.verify_razorpay_signature")
def test_verify_payment_invalid_signature(mock_sig, mock_table):
    mock_sig.return_value = False
    mock_table.get_item.return_value = {"Item": {"payment_id": "pay-1"}}

    body = {
        "payment_id": "pay-1",
        "razorpay_order_id": "rz_ord",
        "razorpay_payment_id": "rz_pay",
        "razorpay_signature": "badsig"
    }
    res = lf.verify_payment(body, MOCK_USER)
    assert res["statusCode"] == 400

# ── get_payment_status ────────────────────────────────────────────────────────
@patch("lambda_function.payment_table")
def test_get_payment_status_success(mock_table):
    mock_table.get_item.return_value = {"Item": {"payment_id": "pay-1", "user_id": "user-123"}}
    res = lf.get_payment_status("pay-1", MOCK_USER)
    assert res["statusCode"] == 200

@patch("lambda_function.payment_table")
def test_get_payment_status_not_found(mock_table):
    mock_table.get_item.return_value = {}
    res = lf.get_payment_status("pay-999", MOCK_USER)
    assert res["statusCode"] == 404

@patch("lambda_function.payment_table")
def test_get_payment_status_forbidden(mock_table):
    mock_table.get_item.return_value = {"Item": {"payment_id": "pay-1", "user_id": "other-user"}}
    res = lf.get_payment_status("pay-1", MOCK_USER)
    assert res["statusCode"] == 403