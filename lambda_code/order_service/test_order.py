import json
import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import lambda_function as lf

MOCK_USER = {"userId": "user-123", "role": "user"}
MOCK_ADMIN = {"userId": "admin-1", "role": "admin"}

MOCK_CART = {
    "items": [
        {
            "product_id": "prod-1",
            "name": "Rice",
            "unit_price": "100.00",
            "quantity": 2,
            "total_price": "200.00"
        }
    ]
}

# ── place_order ───────────────────────────────────────────────────────────────
@patch("lambda_function.deduct_product_stock")
@patch("lambda_function.clear_cart")
@patch("lambda_function.order_table")
@patch("lambda_function.get_cart")
def test_place_order_success(mock_cart, mock_table, mock_clear, mock_deduct):
    mock_cart.return_value = MOCK_CART
    mock_table.put_item = MagicMock()
    mock_clear.return_value = None
    mock_deduct.return_value = True

    res = lf.place_order({"user_id": "user-123"})
    assert res["statusCode"] == 201
    data = json.loads(res["body"])
    assert data["message"] == "Order placed successfully"

@patch("lambda_function.get_cart")
def test_place_order_empty_cart(mock_cart):
    mock_cart.return_value = {"items": []}
    res = lf.place_order({"user_id": "user-123"})
    assert res["statusCode"] == 400

def test_place_order_missing_user_id():
    res = lf.place_order({})
    assert res["statusCode"] == 400

@patch("lambda_function.get_cart")
def test_place_order_cart_not_found(mock_cart):
    mock_cart.return_value = None
    res = lf.place_order({"user_id": "user-123"})
    assert res["statusCode"] == 404

# ── cancel_order ──────────────────────────────────────────────────────────────
@patch("lambda_function.restock_product_stock")
@patch("lambda_function.order_table")
@patch("lambda_function.find_order")
def test_cancel_order_success(mock_find, mock_table, mock_restock):
    mock_find.return_value = {
        "order_id": "ord-1", "status": "PLACED",
        "items": [{"product_id": "p1", "quantity": 2}]
    }
    mock_table.update_item = MagicMock()
    mock_restock.return_value = True

    res = lf.cancel_order("ord-1")
    assert res["statusCode"] == 200

@patch("lambda_function.find_order")
def test_cancel_order_not_found(mock_find):
    mock_find.return_value = None
    res = lf.cancel_order("ord-999")
    assert res["statusCode"] == 404

@patch("lambda_function.find_order")
def test_cancel_order_already_shipped(mock_find):
    mock_find.return_value = {"order_id": "ord-1", "status": "SHIPPED", "items": []}
    res = lf.cancel_order("ord-1")
    assert res["statusCode"] == 409

# ── update_order_status ───────────────────────────────────────────────────────
@patch("lambda_function.find_order")
@patch("lambda_function.order_table")
def test_update_status_success(mock_table, mock_find):
    mock_find.side_effect = [
        {"order_id": "ord-1", "status": "PLACED"},
        {"order_id": "ord-1", "status": "CONFIRMED"}
    ]
    mock_table.update_item = MagicMock()

    res = lf.update_order_status("ord-1", {"status": "CONFIRMED"})
    assert res["statusCode"] == 200

@patch("lambda_function.find_order")
def test_update_status_invalid_transition(mock_find):
    mock_find.return_value = {"order_id": "ord-1", "status": "DELIVERED"}
    res = lf.update_order_status("ord-1", {"status": "PLACED"})
    assert res["statusCode"] == 409