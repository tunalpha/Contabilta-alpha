#!/usr/bin/env python3
import requests
import json
from datetime import datetime
import time
import sys
import os

# Get the backend URL from frontend/.env
BACKEND_URL = "https://b86f4bc0-4274-4f4c-aa78-77ff6fc707ba.preview.emergentagent.com"
API_BASE_URL = f"{BACKEND_URL}/api"

# Test data
income_transactions = [
    {
        "amount": 1500.00,
        "description": "Stipendio mensile",
        "type": "income",
        "category": "Stipendio",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 300.00,
        "description": "Rimborso spese",
        "type": "income",
        "category": "Rimborsi",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 50.00,
        "description": "Regalo compleanno",
        "type": "income",
        "category": "Regali",
        "date": datetime.now().isoformat()
    }
]

expense_transactions = [
    {
        "amount": 400.00,
        "description": "Affitto",
        "type": "expense",
        "category": "Casa",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 120.00,
        "description": "Spesa settimanale",
        "type": "expense",
        "category": "Alimentari",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 35.00,
        "description": "Benzina",
        "type": "expense",
        "category": "Trasporti",
        "date": datetime.now().isoformat()
    }
]

# Helper functions
def print_separator():
    print("\n" + "="*80 + "\n")

def print_test_header(test_name):
    print_separator()
    print(f"TESTING: {test_name}")
    print_separator()

def print_response(response):
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")

def assert_status_code(response, expected_code):
    if response.status_code != expected_code:
        print(f"❌ Expected status code {expected_code}, got {response.status_code}")
        return False
    print(f"✅ Status code is {expected_code} as expected")
    return True

def assert_equal(actual, expected, message):
    if actual != expected:
        print(f"❌ {message}: Expected {expected}, got {actual}")
        return False
    print(f"✅ {message}: Value is {expected} as expected")
    return True

def assert_contains_keys(data, keys, message):
    missing_keys = [key for key in keys if key not in data]
    if missing_keys:
        print(f"❌ {message}: Missing keys: {missing_keys}")
        return False
    print(f"✅ {message}: All required keys present")
    return True

# Test functions
def test_get_all_transactions():
    print_test_header("GET /api/transactions - Get all transactions")
    
    response = requests.get(f"{API_BASE_URL}/transactions")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    transactions = response.json()
    print(f"Found {len(transactions)} transactions")
    
    # Check if transactions have the expected structure
    if transactions:
        required_keys = ["id", "amount", "description", "type", "category", "date"]
        return assert_contains_keys(transactions[0], required_keys, "Transaction structure")
    
    return True

def test_create_transaction(transaction_data):
    print_test_header(f"POST /api/transactions - Create {transaction_data['type']} transaction")
    
    response = requests.post(
        f"{API_BASE_URL}/transactions", 
        json=transaction_data
    )
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    created_transaction = response.json()
    
    # Verify the created transaction has all required fields
    required_keys = ["id", "amount", "description", "type", "category", "date"]
    if not assert_contains_keys(created_transaction, required_keys, "Created transaction structure"):
        return False
    
    # Verify the data matches what we sent
    for key in ["amount", "description", "type", "category"]:
        if not assert_equal(created_transaction[key], transaction_data[key], f"Transaction {key}"):
            return False
    
    return created_transaction["id"]

def test_delete_transaction(transaction_id):
    print_test_header(f"DELETE /api/transactions/{transaction_id} - Delete transaction")
    
    response = requests.delete(f"{API_BASE_URL}/transactions/{transaction_id}")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    # Verify the transaction was deleted
    all_transactions = requests.get(f"{API_BASE_URL}/transactions").json()
    transaction_ids = [t["id"] for t in all_transactions]
    
    if transaction_id in transaction_ids:
        print(f"❌ Transaction {transaction_id} was not deleted")
        return False
    
    print(f"✅ Transaction {transaction_id} was successfully deleted")
    return True

def test_balance_calculation():
    print_test_header("GET /api/balance - Balance calculation")
    
    # First, get the current balance
    response = requests.get(f"{API_BASE_URL}/balance")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    balance_data = response.json()
    required_keys = ["balance", "total_income", "total_expenses"]
    if not assert_contains_keys(balance_data, required_keys, "Balance data structure"):
        return False
    
    # Create a new income and expense transaction
    income_amount = 200.0
    expense_amount = 75.0
    
    income_data = {
        "amount": income_amount,
        "description": "Test income",
        "type": "income",
        "category": "Test",
        "date": datetime.now().isoformat()
    }
    
    expense_data = {
        "amount": expense_amount,
        "description": "Test expense",
        "type": "expense",
        "category": "Test",
        "date": datetime.now().isoformat()
    }
    
    # Add income
    income_id = test_create_transaction(income_data)
    if not income_id:
        return False
    
    # Add expense
    expense_id = test_create_transaction(expense_data)
    if not expense_id:
        return False
    
    # Get updated balance
    updated_response = requests.get(f"{API_BASE_URL}/balance")
    updated_balance = updated_response.json()
    
    # Calculate expected values
    expected_income = balance_data["total_income"] + income_amount
    expected_expenses = balance_data["total_expenses"] + expense_amount
    expected_balance = expected_income - expected_expenses
    
    # Verify calculations
    if not assert_equal(updated_balance["total_income"], expected_income, "Updated total income"):
        return False
    
    if not assert_equal(updated_balance["total_expenses"], expected_expenses, "Updated total expenses"):
        return False
    
    if not assert_equal(updated_balance["balance"], expected_balance, "Updated balance"):
        return False
    
    # Clean up by deleting the test transactions
    test_delete_transaction(income_id)
    test_delete_transaction(expense_id)
    
    return True

def test_error_handling():
    print_test_header("Error handling for invalid data")
    
    # Test with missing required fields
    invalid_transaction = {
        "amount": 100.0,
        # Missing description
        "type": "income",
        "category": "Test"
        # Missing date
    }
    
    response = requests.post(f"{API_BASE_URL}/transactions", json=invalid_transaction)
    print_response(response)
    
    # Should return a 422 Unprocessable Entity for validation errors
    if not assert_status_code(response, 422):
        return False
    
    # Test with invalid transaction type
    invalid_type_transaction = {
        "amount": 100.0,
        "description": "Invalid type test",
        "type": "invalid_type",  # Not 'income' or 'expense'
        "category": "Test",
        "date": datetime.now().isoformat()
    }
    
    response = requests.post(f"{API_BASE_URL}/transactions", json=invalid_type_transaction)
    print_response(response)
    
    # Test with invalid transaction ID for deletion
    invalid_id = "non_existent_id"
    response = requests.delete(f"{API_BASE_URL}/transactions/{invalid_id}")
    print_response(response)
    
    # Should return a 404 Not Found
    if not assert_status_code(response, 404):
        return False
    
    return True

def run_all_tests():
    print("\n🔍 STARTING BACKEND API TESTS 🔍\n")
    
    # Test getting all transactions
    if not test_get_all_transactions():
        print("❌ Get all transactions test failed")
    else:
        print("✅ Get all transactions test passed")
    
    # Test creating income transactions
    income_ids = []
    for income in income_transactions:
        transaction_id = test_create_transaction(income)
        if transaction_id:
            income_ids.append(transaction_id)
    
    # Test creating expense transactions
    expense_ids = []
    for expense in expense_transactions:
        transaction_id = test_create_transaction(expense)
        if transaction_id:
            expense_ids.append(transaction_id)
    
    # Test balance calculation
    if not test_balance_calculation():
        print("❌ Balance calculation test failed")
    else:
        print("✅ Balance calculation test passed")
    
    # Test error handling
    if not test_error_handling():
        print("❌ Error handling test failed")
    else:
        print("✅ Error handling test passed")
    
    # Clean up by deleting all created transactions
    print("\n🧹 Cleaning up test data...")
    for transaction_id in income_ids + expense_ids:
        test_delete_transaction(transaction_id)
    
    print("\n🏁 ALL TESTS COMPLETED 🏁\n")

if __name__ == "__main__":
    run_all_tests()