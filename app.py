import os
import re
import hmac
import hashlib
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_ORIGIN", "*")}})

NOWPAYMENTS_URL = "https://api.nowpayments.io/v1/invoice"


def parse_price(value):
    if not isinstance(value, str):
        raise ValueError("Order price is invalid")
    cleaned = re.sub(r"[^0-9.]", "", value)
    try:
        amount = Decimal(cleaned)
    except InvalidOperation as error:
        raise ValueError("Order price is invalid") from error
    if amount <= 0 or amount > Decimal("10000000"):
        raise ValueError("Order price is outside the allowed range")
    return format(amount.quantize(Decimal("0.01")), "f")


def create_nowpayments_invoice(order_id, order):
    api_key = os.getenv("NOWPAYMENTS_API_KEY")
    if not api_key:
        raise RuntimeError("NOWPAYMENTS_API_KEY is not configured")
    callback_url = os.getenv("NOWPAYMENTS_IPN_CALLBACK_URL")
    if not callback_url:
        raise RuntimeError("NOWPAYMENTS_IPN_CALLBACK_URL is not configured")

    payload = {
        "price_amount": parse_price(order.get("price")),
        "price_currency": os.getenv("NOWPAYMENTS_PRICE_CURRENCY", "usd"),
        "order_id": order_id,
        "order_description": order.get("productName", "MineForge order"),
        "ipn_callback_url": callback_url,
        "success_url": os.getenv("NOWPAYMENTS_SUCCESS_URL", ""),
        "cancel_url": os.getenv("NOWPAYMENTS_CANCEL_URL", ""),
    }
    payload = {key: value for key, value in payload.items() if value}
    body = json.dumps(payload).encode("utf-8")
    request_data = Request(
        NOWPAYMENTS_URL,
        data=body,
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request_data, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"NOWPayments rejected the invoice: {detail}") from error
    except (URLError, json.JSONDecodeError) as error:
        raise RuntimeError("NOWPayments is unavailable") from error


@app.post("/api/create-payment")
def create_payment():
    body = request.get_json(silent=True) or {}
    order_id = body.get("orderId")
    if not isinstance(order_id, str) or not order_id or len(order_id) > 128:
        return jsonify({"error": "A valid order ID is required"}), 400

    order = body.get("order")
    if not isinstance(order, dict):
        return jsonify({"error": "Order details are required"}), 400
    required_fields = ("price", "productName", "customerEmail")
    if any(not isinstance(order.get(field), str) or not order[field].strip() for field in required_fields):
        return jsonify({"error": "Incomplete order details"}), 400
    try:
        payment_amount = Decimal(parse_price(order["price"]))
        full_amount = Decimal(parse_price(order.get("fullPrice", order["price"])))
        minimum_amount = Decimal(parse_price(order.get("minimumPayment") or "$1"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    payment_type = order.get("paymentType", "full")
    if payment_type not in ("full", "partial"):
        return jsonify({"error": "Invalid payment type"}), 400
    if payment_type == "full" and payment_amount != full_amount:
        return jsonify({"error": "Full payment must match the listed price"}), 400
    if payment_type == "partial" and (payment_amount < minimum_amount or payment_amount > full_amount):
        return jsonify({"error": "Partial payment is outside the allowed range"}), 400

    try:
        invoice = create_nowpayments_invoice(order_id, order)
        return jsonify({"paymentUrl": invoice.get("invoice_url"), "invoiceId": invoice.get("id")})
    except (RuntimeError, ValueError) as error:
        return jsonify({"error": str(error)}), 502


@app.post("/api/nowpayments-ipn")
def nowpayments_ipn():
    signature = request.headers.get("x-nowpayments-sig", "")
    ipn_secret = os.getenv("NOWPAYMENTS_IPN_SECRET")
    if not ipn_secret:
        return jsonify({"error": "IPN secret is not configured"}), 503
    payload = request.get_json(silent=True) or {}
    canonical_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    expected_signature = hmac.new(ipn_secret.encode("utf-8"), canonical_payload, hashlib.sha512).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return jsonify({"error": "Invalid IPN signature"}), 401
    order_id = payload.get("order_id")
    if not order_id:
        return jsonify({"error": "Missing order_id"}), 400
    status = payload.get("payment_status", "unknown")
    allowed_statuses = {"waiting", "confirming", "confirmed", "finished", "failed", "refunded", "expired"}
    if status not in allowed_statuses:
        status = "unknown"
    app.logger.info("NOWPayments order %s status: %s (payment %s)", order_id, status, payload.get("payment_id"))
    return jsonify({"ok": True, "orderId": order_id, "status": status})


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG") == "1")
