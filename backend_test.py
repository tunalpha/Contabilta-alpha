#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta
import time
import sys
import os
import re

# Get the backend URL from frontend/.env
BACKEND_URL = "https://c55fcfe6-e60c-4f75-9cb2-53dc045c2818.preview.emergentagent.com"
API_BASE_URL = f"{BACKEND_URL}/api"

# Test data with updated terminology (avere/dare)
avere_transactions = [
    {
        "amount": 1500.00,
        "description": "Stipendio mensile",
        "type": "avere",
        "category": "Bonifico",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 300.00,
        "description": "Rimborso spese",
        "type": "avere",
        "category": "Cash",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 50.00,
        "description": "Regalo compleanno",
        "type": "avere",
        "category": "PayPal",
        "date": datetime.now().isoformat()
    }
]

dare_transactions = [
    {
        "amount": 400.00,
        "description": "Affitto",
        "type": "dare",
        "category": "Bonifico",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 120.00,
        "description": "Spesa settimanale",
        "type": "dare",
        "category": "Cash",
        "date": datetime.now().isoformat()
    },
    {
        "amount": 35.00,
        "description": "Benzina",
        "type": "dare",
        "category": "Altro",
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
    print(f"Headers: {response.headers}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        if 'application/pdf' in response.headers.get('Content-Type', ''):
            print(f"Response: [PDF Content] - Size: {len(response.content)} bytes")
        else:
            print(f"Response: {response.text[:500]}...")

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

def assert_content_type(response, expected_type, message="Content-Type"):
    content_type = response.headers.get('Content-Type', '')
    if expected_type not in content_type:
        print(f"❌ {message}: Expected {expected_type}, got {content_type}")
        return False
    print(f"✅ {message}: Content-Type is {content_type} as expected")
    return True

def assert_content_disposition(response, expected_pattern, message="Content-Disposition"):
    content_disposition = response.headers.get('Content-Disposition', '')
    if not re.search(expected_pattern, content_disposition):
        print(f"❌ {message}: Expected pattern {expected_pattern}, got {content_disposition}")
        return False
    print(f"✅ {message}: Content-Disposition matches expected pattern")
    return True

def get_client_slug():
    """Get a valid client slug from the public clients endpoint"""
    response = requests.get(f"{API_BASE_URL}/clients/public")
    if response.status_code != 200 or not response.json():
        print("❌ Failed to get client slug. No clients available.")
        return None
    
    # Return the slug of the first client
    return response.json()[0]["slug"]

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

def test_create_transaction(transaction_data, admin_token=None):
    print_test_header(f"POST /api/transactions - Create {transaction_data['type']} transaction")
    
    headers = {}
    if admin_token:
        headers["Authorization"] = f"Bearer {admin_token}"
    
    response = requests.post(
        f"{API_BASE_URL}/transactions", 
        json=transaction_data,
        headers=headers
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

def test_delete_transaction(transaction_id, admin_token=None):
    print_test_header(f"DELETE /api/transactions/{transaction_id} - Delete transaction")
    
    headers = {}
    if admin_token:
        headers["Authorization"] = f"Bearer {admin_token}"
    
    response = requests.delete(f"{API_BASE_URL}/transactions/{transaction_id}", headers=headers)
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
    required_keys = ["balance", "total_avere", "total_dare"]
    if not assert_contains_keys(balance_data, required_keys, "Balance data structure"):
        return False
    
    # Get admin token for creating transactions
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token for transaction creation")
        return False
    
    # Create a new avere and dare transaction
    avere_amount = 200.0
    dare_amount = 75.0
    
    avere_data = {
        "client_id": get_client_id(),
        "amount": avere_amount,
        "description": "Test avere",
        "type": "avere",
        "category": "Cash",
        "date": datetime.now().isoformat()
    }
    
    dare_data = {
        "client_id": get_client_id(),
        "amount": dare_amount,
        "description": "Test dare",
        "type": "dare",
        "category": "Cash",
        "date": datetime.now().isoformat()
    }
    
    # Add avere
    avere_id = test_create_transaction(avere_data, admin_token)
    if not avere_id:
        return False
    
    # Add dare
    dare_id = test_create_transaction(dare_data, admin_token)
    if not dare_id:
        return False
    
    # Get updated balance
    updated_response = requests.get(f"{API_BASE_URL}/balance")
    updated_balance = updated_response.json()
    
    # Calculate expected values
    expected_avere = balance_data["total_avere"] + avere_amount
    expected_dare = balance_data["total_dare"] + dare_amount
    expected_balance = expected_avere - expected_dare
    
    # Verify calculations
    if not assert_equal(updated_balance["total_avere"], expected_avere, "Updated total avere"):
        return False
    
    if not assert_equal(updated_balance["total_dare"], expected_dare, "Updated total dare"):
        return False
    
    if not assert_equal(updated_balance["balance"], expected_balance, "Updated balance"):
        return False
    
    # Clean up by deleting the test transactions
    test_delete_transaction(avere_id, admin_token)
    test_delete_transaction(dare_id, admin_token)
    
    return True

def get_admin_token():
    """Get admin token for authenticated requests"""
    login_data = {"password": "alpha2024!"}
    response = requests.post(f"{API_BASE_URL}/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Admin login failed: {response.text}")
        return None
    
    login_response = response.json()
    if not login_response.get("success"):
        print(f"❌ Admin login failed: {login_response.get('message')}")
        return None
    
    return login_response.get("token")

def get_client_id():
    """Get a valid client ID for creating transactions"""
    response = requests.get(f"{API_BASE_URL}/clients/public")
    if response.status_code != 200 or not response.json():
        print("❌ Failed to get client ID. No clients available.")
        return None
    
    # Return the ID of the first client
    return response.json()[0]["id"]

def test_pdf_generation_with_date_filtering():
    print_test_header("GET /api/clients/{client_slug}/pdf - PDF generation with date filtering")
    
    client_slug = get_client_slug()
    if not client_slug:
        print("❌ Cannot test PDF generation without a valid client slug")
        return False
    
    # Define date range (last month)
    today = datetime.now()
    date_from = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    date_to = today.strftime("%Y-%m-%d")
    
    # Test with both date_from and date_to
    print(f"Testing PDF generation with date range: {date_from} to {date_to}")
    response = requests.get(
        f"{API_BASE_URL}/clients/{client_slug}/pdf?date_from={date_from}&date_to={date_to}"
    )
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    if not assert_content_type(response, "application/pdf"):
        return False
    
    # Check that the filename includes the date range
    expected_filename_pattern = f"estratto_conto_{client_slug}_{date_from}_{date_to}"
    if not assert_content_disposition(response, expected_filename_pattern):
        return False
    
    print(f"✅ PDF generated successfully with date filtering from {date_from} to {date_to}")
    return True

def test_pdf_generation_with_single_date_filters():
    print_test_header("GET /api/clients/{client_slug}/pdf - PDF generation with single date filter")
    
    client_slug = get_client_slug()
    if not client_slug:
        print("❌ Cannot test PDF generation without a valid client slug")
        return False
    
    # Define dates
    today = datetime.now()
    date_from = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    date_to = today.strftime("%Y-%m-%d")
    
    # Test with only date_from
    print(f"Testing PDF generation with only date_from: {date_from}")
    response_from = requests.get(
        f"{API_BASE_URL}/clients/{client_slug}/pdf?date_from={date_from}"
    )
    print_response(response_from)
    
    if not assert_status_code(response_from, 200):
        return False
    
    if not assert_content_type(response_from, "application/pdf"):
        return False
    
    # Check that the filename includes the date_from
    expected_filename_pattern_from = f"estratto_conto_{client_slug}_dal_{date_from}"
    if not assert_content_disposition(response_from, expected_filename_pattern_from):
        return False
    
    print(f"✅ PDF generated successfully with only date_from: {date_from}")
    
    # Test with only date_to
    print(f"Testing PDF generation with only date_to: {date_to}")
    response_to = requests.get(
        f"{API_BASE_URL}/clients/{client_slug}/pdf?date_to={date_to}"
    )
    print_response(response_to)
    
    if not assert_status_code(response_to, 200):
        return False
    
    if not assert_content_type(response_to, "application/pdf"):
        return False
    
    # Check that the filename includes the date_to
    expected_filename_pattern_to = f"estratto_conto_{client_slug}_al_{date_to}"
    if not assert_content_disposition(response_to, expected_filename_pattern_to):
        return False
    
    print(f"✅ PDF generated successfully with only date_to: {date_to}")
    return True

def test_pdf_generation_without_date_filters():
    print_test_header("GET /api/clients/{client_slug}/pdf - PDF generation without date filters")
    
    client_slug = get_client_slug()
    if not client_slug:
        print("❌ Cannot test PDF generation without a valid client slug")
        return False
    
    # Test without any date parameters
    print("Testing PDF generation without date filters")
    response = requests.get(f"{API_BASE_URL}/clients/{client_slug}/pdf")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    if not assert_content_type(response, "application/pdf"):
        return False
    
    # Check that the filename does not include date range
    expected_filename_pattern = f"estratto_conto_{client_slug}_"
    if not assert_content_disposition(response, expected_filename_pattern):
        return False
    
    print("✅ PDF generated successfully without date filters")
    return True

def test_pdf_data_integrity():
    print_test_header("PDF Data Integrity Test")
    
    # Get a valid client slug
    client_slug = get_client_slug()
    if not client_slug:
        print("❌ Cannot test PDF data integrity without a valid client slug")
        return False
    
    # First, get all transactions for this client to verify count
    response_transactions = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}")
    if not assert_status_code(response_transactions, 200):
        return False
    
    all_transactions = response_transactions.json()
    transaction_count = len(all_transactions)
    print(f"Client has {transaction_count} total transactions")
    
    # Get balance for this client
    response_balance = requests.get(f"{API_BASE_URL}/balance?client_slug={client_slug}")
    if not assert_status_code(response_balance, 200):
        return False
    
    balance_data = response_balance.json()
    total_avere = balance_data["total_avere"]
    total_dare = balance_data["total_dare"]
    balance = balance_data["balance"]
    
    print(f"Client balance: {balance} (total_avere: {total_avere}, total_dare: {total_dare})")
    
    # Now get PDF without filters (should include all transactions)
    response_pdf = requests.get(f"{API_BASE_URL}/clients/{client_slug}/pdf")
    if not assert_status_code(response_pdf, 200):
        return False
    
    if not assert_content_type(response_pdf, "application/pdf"):
        return False
    
    # We can't directly inspect PDF content, but we can verify it was generated
    pdf_size = len(response_pdf.content)
    print(f"Generated PDF size: {pdf_size} bytes")
    
    if pdf_size < 1000:  # A reasonable minimum size for a PDF with data
        print("❌ PDF seems too small, might not contain proper data")
        return False
    
    print("✅ PDF data integrity test passed")
    return True

def test_error_handling():
    print_test_header("Error handling for invalid data")
    
    # Test with invalid client slug for PDF generation
    invalid_slug = "non-existent-client"
    response = requests.get(f"{API_BASE_URL}/clients/{invalid_slug}/pdf")
    print_response(response)
    
    # Should return a 404 Not Found
    if not assert_status_code(response, 404):
        return False
    
    # Test with invalid date format
    client_slug = get_client_slug()
    if client_slug:
        invalid_date = "not-a-date"
        response = requests.get(f"{API_BASE_URL}/clients/{client_slug}/pdf?date_from={invalid_date}")
        print_response(response)
        
        # Should return an error (422 or 500)
        if response.status_code not in [422, 500]:
            print(f"❌ Expected error status code for invalid date, got {response.status_code}")
            return False
    
    return True

def run_all_tests():
    print("\n🔍 STARTING BACKEND API TESTS 🔍\n")
    
    # Test PDF generation with date filtering
    if not test_pdf_generation_with_date_filtering():
        print("❌ PDF generation with date filtering test failed")
    else:
        print("✅ PDF generation with date filtering test passed")
    
    # Test PDF generation with single date filters
    if not test_pdf_generation_with_single_date_filters():
        print("❌ PDF generation with single date filters test failed")
    else:
        print("✅ PDF generation with single date filters test passed")
    
    # Test PDF generation without date filters
    if not test_pdf_generation_without_date_filters():
        print("❌ PDF generation without date filters test failed")
    else:
        print("✅ PDF generation without date filters test passed")
    
    # Test PDF data integrity
    if not test_pdf_data_integrity():
        print("❌ PDF data integrity test failed")
    else:
        print("✅ PDF data integrity test passed")
    
    # Test error handling
    if not test_error_handling():
        print("❌ Error handling test failed")
    else:
        print("✅ Error handling test passed")
    
    print("\n🏁 ALL PDF GENERATION TESTS COMPLETED 🏁\n")

if __name__ == "__main__":
    run_all_tests()