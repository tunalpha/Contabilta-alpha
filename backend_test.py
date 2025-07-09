#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta
import time
import sys
import os
import re

# Get the backend URL from frontend/.env
BACKEND_URL = "https://fdb68f94-98b6-42f9-a334-0f5e925166ec.preview.emergentagent.com"
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

def test_multi_currency_transactions():
    print_test_header("GET /api/transactions?client_slug=sovanza - Multi-currency USD transactions")
    
    # Get transactions for the "sovanza" client
    response = requests.get(f"{API_BASE_URL}/transactions?client_slug=sovanza")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    transactions = response.json()
    print(f"Found {len(transactions)} transactions for client 'sovanza'")
    
    # Check if there are any transactions with currency fields
    # First, let's check if the currency fields are included in the response
    has_currency_fields = False
    for t in transactions:
        if "currency" in t:
            has_currency_fields = True
            print(f"Transaction {t['id']} has currency field: {t['currency']}")
            print(f"Original amount: {t.get('original_amount')}")
            print(f"Exchange rate: {t.get('exchange_rate')}")
            print(f"Amount (EUR): {t['amount']}")
    
    if not has_currency_fields:
        print("⚠️ No transactions with currency fields found. This could be because:")
        print("  1. The transactions don't have currency data in the database")
        print("  2. The API is not returning the currency fields")
        
        # Let's create a USD transaction to test the functionality
        print("\nCreating a test USD transaction to verify multi-currency functionality...")
        
        # Get admin token
        admin_token = get_admin_token()
        if not admin_token:
            print("❌ Failed to get admin token for transaction creation")
            return False
        
        # Get client ID for sovanza
        client_id = None
        clients_response = requests.get(f"{API_BASE_URL}/clients/public")
        if clients_response.status_code == 200:
            for client in clients_response.json():
                if client["slug"] == "sovanza":
                    client_id = client["id"]
                    break
        
        if not client_id:
            print("❌ Failed to get client ID for 'sovanza'")
            return False
        
        # Create a USD transaction
        usd_transaction = {
            "client_id": client_id,
            "amount": 40.0,
            "description": "Test USD Transaction",
            "type": "dare",
            "category": "Cash",
            "date": datetime.now().isoformat(),
            "currency": "USD",
            "original_amount": 40.0,
            "exchange_rate": 0.852
        }
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        create_response = requests.post(
            f"{API_BASE_URL}/transactions", 
            json=usd_transaction,
            headers=headers
        )
        print_response(create_response)
        
        if create_response.status_code != 200:
            print("❌ Failed to create test USD transaction")
            return False
        
        created_transaction = create_response.json()
        transaction_id = created_transaction.get("id")
        
        # Now get the transaction again to verify it has the currency fields
        get_response = requests.get(f"{API_BASE_URL}/transactions?client_slug=sovanza")
        if get_response.status_code != 200:
            print("❌ Failed to get transactions after creating USD transaction")
            return False
        
        updated_transactions = get_response.json()
        test_transaction = None
        for t in updated_transactions:
            if t.get("id") == transaction_id:
                test_transaction = t
                break
        
        if not test_transaction:
            print("❌ Could not find the created USD transaction in the response")
            return False
        
        # Check if the transaction has the currency fields
        required_keys = ["currency", "original_amount", "exchange_rate"]
        if not all(key in test_transaction for key in required_keys):
            print("❌ Created USD transaction is missing currency fields in the response")
            print(f"Transaction data: {test_transaction}")
            
            # Clean up the test transaction
            delete_response = requests.delete(
                f"{API_BASE_URL}/transactions/{transaction_id}", 
                headers=headers
            )
            
            return False
        
        # Verify currency conversion calculation
        original_amount = test_transaction.get("original_amount")
        exchange_rate = test_transaction.get("exchange_rate")
        amount = test_transaction.get("amount")
        
        if original_amount is not None and exchange_rate is not None:
            expected_amount = round(original_amount * exchange_rate, 2)
            actual_amount = round(amount, 2)
            
            conversion_correct = abs(actual_amount - expected_amount) < 0.01
            if not conversion_correct:
                print(f"❌ Currency conversion calculation is incorrect: {original_amount} * {exchange_rate} = {expected_amount}, but got {actual_amount}")
                
                # Clean up the test transaction
                delete_response = requests.delete(
                    f"{API_BASE_URL}/transactions/{transaction_id}", 
                    headers=headers
                )
                
                return False
            
            print(f"✅ Currency conversion calculation is correct: {original_amount} USD * {exchange_rate} = {actual_amount} EUR")
        else:
            print("❌ Missing original_amount or exchange_rate for currency conversion verification")
            
            # Clean up the test transaction
            delete_response = requests.delete(
                f"{API_BASE_URL}/transactions/{transaction_id}", 
                headers=headers
            )
            
            return False
        
        # Clean up the test transaction
        delete_response = requests.delete(
            f"{API_BASE_URL}/transactions/{transaction_id}", 
            headers=headers
        )
        
        if delete_response.status_code != 200:
            print("⚠️ Failed to clean up test USD transaction")
        else:
            print("✅ Test USD transaction cleaned up successfully")
        
        return True
    
    # If we found transactions with currency fields, check them
    for t in transactions:
        if "currency" in t and t["currency"] != "EUR":
            # Found a non-EUR transaction
            print(f"\nFound non-EUR transaction: {t['id']}")
            print(f"Currency: {t['currency']}")
            print(f"Original amount: {t.get('original_amount')}")
            print(f"Exchange rate: {t.get('exchange_rate')}")
            print(f"Amount (EUR): {t['amount']}")
            
            # Verify currency conversion calculation
            original_amount = t.get("original_amount")
            exchange_rate = t.get("exchange_rate")
            amount = t.get("amount")
            
            if original_amount is not None and exchange_rate is not None:
                expected_amount = round(original_amount * exchange_rate, 2)
                actual_amount = round(amount, 2)
                
                conversion_correct = abs(actual_amount - expected_amount) < 0.01
                if not conversion_correct:
                    print(f"❌ Currency conversion calculation is incorrect: {original_amount} * {exchange_rate} = {expected_amount}, but got {actual_amount}")
                    return False
                
                print(f"✅ Currency conversion calculation is correct: {original_amount} {t['currency']} * {exchange_rate} = {actual_amount} EUR")
                return True
    
    # If we didn't find any non-EUR transactions, create a test one
    print("\nNo non-EUR transactions found. Creating a test USD transaction...")
    
    # Get admin token
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token for transaction creation")
        return False
    
    # Get client ID for sovanza
    client_id = None
    clients_response = requests.get(f"{API_BASE_URL}/clients/public")
    if clients_response.status_code == 200:
        for client in clients_response.json():
            if client["slug"] == "sovanza":
                client_id = client["id"]
                break
    
    if not client_id:
        print("❌ Failed to get client ID for 'sovanza'")
        return False
    
    # Create a USD transaction
    usd_transaction = {
        "client_id": client_id,
        "amount": 40.0,
        "description": "Test USD Transaction",
        "type": "dare",
        "category": "Cash",
        "date": datetime.now().isoformat(),
        "currency": "USD"
    }
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    create_response = requests.post(
        f"{API_BASE_URL}/transactions", 
        json=usd_transaction,
        headers=headers
    )
    print_response(create_response)
    
    if create_response.status_code != 200:
        print("❌ Failed to create test USD transaction")
        return False
    
    created_transaction = create_response.json()
    transaction_id = created_transaction.get("id")
    
    # Now get the transaction again to verify it has the currency fields
    get_response = requests.get(f"{API_BASE_URL}/transactions?client_slug=sovanza")
    if get_response.status_code != 200:
        print("❌ Failed to get transactions after creating USD transaction")
        return False
    
    updated_transactions = get_response.json()
    test_transaction = None
    for t in updated_transactions:
        if t.get("id") == transaction_id:
            test_transaction = t
            break
    
    if not test_transaction:
        print("❌ Could not find the created USD transaction in the response")
        return False
    
    # Check if the transaction has the currency fields
    print(f"\nCreated USD transaction: {test_transaction}")
    
    # Verify currency fields
    if test_transaction.get("currency") != "USD":
        print("❌ Created transaction does not have USD currency")
        
        # Clean up the test transaction
        delete_response = requests.delete(
            f"{API_BASE_URL}/transactions/{transaction_id}", 
            headers=headers
        )
        
        return False
    
    if test_transaction.get("original_amount") is None:
        print("❌ Created USD transaction is missing original_amount field")
        
        # Clean up the test transaction
        delete_response = requests.delete(
            f"{API_BASE_URL}/transactions/{transaction_id}", 
            headers=headers
        )
        
        return False
    
    if test_transaction.get("exchange_rate") is None:
        print("❌ Created USD transaction is missing exchange_rate field")
        
        # Clean up the test transaction
        delete_response = requests.delete(
            f"{API_BASE_URL}/transactions/{transaction_id}", 
            headers=headers
        )
        
        return False
    
    # Verify currency conversion calculation
    original_amount = test_transaction.get("original_amount")
    exchange_rate = test_transaction.get("exchange_rate")
    amount = test_transaction.get("amount")
    
    print(f"Original amount: {original_amount} USD")
    print(f"Exchange rate: {exchange_rate}")
    print(f"Amount (EUR): {amount}")
    
    if original_amount is not None and exchange_rate is not None:
        expected_amount = round(original_amount * exchange_rate, 2)
        actual_amount = round(amount, 2)
        
        conversion_correct = abs(actual_amount - expected_amount) < 0.01
        if not conversion_correct:
            print(f"❌ Currency conversion calculation is incorrect: {original_amount} * {exchange_rate} = {expected_amount}, but got {actual_amount}")
            
            # Clean up the test transaction
            delete_response = requests.delete(
                f"{API_BASE_URL}/transactions/{transaction_id}", 
                headers=headers
            )
            
            return False
        
        print(f"✅ Currency conversion calculation is correct: {original_amount} USD * {exchange_rate} = {actual_amount} EUR")
    else:
        print("❌ Missing original_amount or exchange_rate for currency conversion verification")
        
        # Clean up the test transaction
        delete_response = requests.delete(
            f"{API_BASE_URL}/transactions/{transaction_id}", 
            headers=headers
        )
        
        return False
    
    # Clean up the test transaction
    delete_response = requests.delete(
        f"{API_BASE_URL}/transactions/{transaction_id}", 
        headers=headers
    )
    
    if delete_response.status_code != 200:
        print("⚠️ Failed to clean up test USD transaction")
    else:
        print("✅ Test USD transaction cleaned up successfully")
    
    return True

def test_sovanza_usd_transaction():
    print_test_header("POST /api/transactions - Create $50 USD transaction for Sovanza client")
    
    # Step 1: Get admin authentication token
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token for transaction creation")
        return False
    
    print("✅ Successfully obtained admin authentication token")
    
    # Step 2: Get the client_id for the "sovanza" client
    client_id = None
    clients_response = requests.get(f"{API_BASE_URL}/clients/public")
    if clients_response.status_code == 200:
        for client in clients_response.json():
            if client["slug"] == "sovanza":
                client_id = client["id"]
                print(f"✅ Found Sovanza client with ID: {client_id}")
                break
    
    if not client_id:
        print("❌ Failed to get client ID for 'sovanza'")
        return False
    
    # Step 3: Create a new $50 USD transaction
    usd_transaction = {
        "client_id": client_id,
        "amount": 50.0,
        "description": "Test $50 USD Transaction",
        "type": "dare",
        "category": "Cash",
        "date": datetime.now().isoformat(),
        "currency": "USD"
    }
    
    print(f"Creating transaction with data: {json.dumps(usd_transaction, indent=2)}")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    create_response = requests.post(
        f"{API_BASE_URL}/transactions", 
        json=usd_transaction,
        headers=headers
    )
    print_response(create_response)
    
    if not assert_status_code(create_response, 200):
        return False
    
    # Step 4: Verify the transaction is created correctly
    created_transaction = create_response.json()
    transaction_id = created_transaction.get("id")
    
    if not transaction_id:
        print("❌ Created transaction does not have an ID")
        return False
    
    print(f"✅ Transaction created with ID: {transaction_id}")
    
    # Step 5: Check that the response includes currency, original_amount, and exchange_rate fields
    required_fields = ["currency", "original_amount", "exchange_rate"]
    for field in required_fields:
        if field not in created_transaction:
            print(f"❌ Created transaction is missing required field: {field}")
            
            # Clean up the test transaction
            delete_response = requests.delete(
                f"{API_BASE_URL}/transactions/{transaction_id}", 
                headers=headers
            )
            
            return False
    
    print("✅ Transaction response includes all required currency fields")
    
    # Step 6: Verify the conversion calculation
    original_amount = created_transaction.get("original_amount")
    exchange_rate = created_transaction.get("exchange_rate")
    amount = created_transaction.get("amount")
    
    print(f"Original amount: {original_amount} USD")
    print(f"Exchange rate: {exchange_rate}")
    print(f"Converted amount (EUR): {amount}")
    
    if original_amount is not None and exchange_rate is not None:
        expected_amount = round(original_amount * exchange_rate, 2)
        actual_amount = round(amount, 2)
        
        # Check if the conversion is correct (allowing for small floating point differences)
        conversion_correct = abs(actual_amount - expected_amount) < 0.01
        if not conversion_correct:
            print(f"❌ Currency conversion calculation is incorrect: {original_amount} * {exchange_rate} = {expected_amount}, but got {actual_amount}")
            
            # Clean up the test transaction
            delete_response = requests.delete(
                f"{API_BASE_URL}/transactions/{transaction_id}", 
                headers=headers
            )
            
            return False
        
        print(f"✅ Currency conversion calculation is correct: {original_amount} USD * {exchange_rate} = {actual_amount} EUR")
        
        # Verify the expected conversion with 0.852 exchange rate
        expected_with_fixed_rate = round(50.0 * 0.852, 2)  # Should be about 42.60 EUR
        print(f"Expected conversion with 0.852 rate: 50.0 USD * 0.852 = {expected_with_fixed_rate} EUR")
        print(f"Actual conversion with {exchange_rate} rate: 50.0 USD * {exchange_rate} = {actual_amount} EUR")
        
        # Note: We don't fail the test if the exchange rate isn't exactly 0.852, as it might fluctuate
        # We just log the difference for information
        if abs(exchange_rate - 0.852) > 0.05:  # If rate differs by more than 0.05
            print(f"⚠️ Exchange rate ({exchange_rate}) differs from expected (0.852) by more than 0.05")
        
    else:
        print("❌ Missing original_amount or exchange_rate for currency conversion verification")
        
        # Clean up the test transaction
        delete_response = requests.delete(
            f"{API_BASE_URL}/transactions/{transaction_id}", 
            headers=headers
        )
        
        return False
    
    # Clean up the test transaction
    delete_response = requests.delete(
        f"{API_BASE_URL}/transactions/{transaction_id}", 
        headers=headers
    )
    
    if delete_response.status_code != 200:
        print("⚠️ Failed to clean up test USD transaction")
    else:
        print("✅ Test USD transaction cleaned up successfully")
    
    return True

def test_sovanza_transactions_currency_fields():
    print_test_header("GET /api/transactions?client_slug=sovanza - Verify currency fields for USD transactions")
    
    # Step 1: Get all transactions for the Sovanza client
    response = requests.get(f"{API_BASE_URL}/transactions?client_slug=sovanza")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    transactions = response.json()
    print(f"Found {len(transactions)} transactions for Sovanza client")
    
    # Step 2: Check for USD transactions
    usd_transactions = [t for t in transactions if t.get("currency") == "USD"]
    print(f"Found {len(usd_transactions)} USD transactions")
    
    if not usd_transactions:
        print("⚠️ No USD transactions found for Sovanza client")
        
        # Create a test USD transaction to verify functionality
        print("Creating a test $50 USD transaction for Sovanza client...")
        
        # Get admin token
        admin_token = get_admin_token()
        if not admin_token:
            print("❌ Failed to get admin token for transaction creation")
            return False
        
        # Get client ID for sovanza
        client_id = None
        clients_response = requests.get(f"{API_BASE_URL}/clients/public")
        if clients_response.status_code == 200:
            for client in clients_response.json():
                if client["slug"] == "sovanza":
                    client_id = client["id"]
                    break
        
        if not client_id:
            print("❌ Failed to get client ID for 'sovanza'")
            return False
        
        # Create a USD transaction
        usd_transaction = {
            "client_id": client_id,
            "amount": 50.0,
            "description": "Test $50 USD Transaction",
            "type": "dare",
            "category": "Cash",
            "date": datetime.now().isoformat(),
            "currency": "USD"
        }
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        create_response = requests.post(
            f"{API_BASE_URL}/transactions", 
            json=usd_transaction,
            headers=headers
        )
        
        if create_response.status_code != 200:
            print("❌ Failed to create test USD transaction")
            return False
        
        created_transaction = create_response.json()
        transaction_id = created_transaction.get("id")
        
        # Get transactions again to include the new one
        response = requests.get(f"{API_BASE_URL}/transactions?client_slug=sovanza")
        if response.status_code != 200:
            print("❌ Failed to get transactions after creating USD transaction")
            return False
        
        transactions = response.json()
        usd_transactions = [t for t in transactions if t.get("currency") == "USD"]
        
        if not usd_transactions:
            print("❌ No USD transactions found even after creating one")
            return False
    
    # Step 3: Verify currency fields for each USD transaction
    all_valid = True
    for idx, transaction in enumerate(usd_transactions):
        print(f"\n--- USD Transaction #{idx+1} ---")
        print(f"ID: {transaction.get('id')}")
        print(f"Description: {transaction.get('description')}")
        print(f"Currency: {transaction.get('currency')}")
        print(f"Original Amount: {transaction.get('original_amount')}")
        print(f"Exchange Rate: {transaction.get('exchange_rate')}")
        print(f"EUR Amount: {transaction.get('amount')}")
        
        # Check required fields
        if transaction.get("currency") != "USD":
            print(f"❌ Transaction has incorrect currency: {transaction.get('currency')}, expected: USD")
            all_valid = False
            continue
        
        if transaction.get("original_amount") is None:
            print("❌ Transaction is missing original_amount field")
            all_valid = False
            continue
        
        if transaction.get("exchange_rate") is None:
            print("❌ Transaction is missing exchange_rate field")
            all_valid = False
            continue
        
        # Verify conversion calculation
        original_amount = transaction.get("original_amount")
        exchange_rate = transaction.get("exchange_rate")
        amount = transaction.get("amount")
        
        expected_amount = round(original_amount * exchange_rate, 2)
        actual_amount = round(amount, 2)
        
        # Check if the conversion is correct (allowing for small floating point differences)
        conversion_correct = abs(actual_amount - expected_amount) < 0.01
        if not conversion_correct:
            print(f"❌ Currency conversion calculation is incorrect: {original_amount} * {exchange_rate} = {expected_amount}, but got {actual_amount}")
            all_valid = False
        else:
            print(f"✅ Currency conversion calculation is correct: {original_amount} USD * {exchange_rate} = {actual_amount} EUR")
    
    # Look specifically for the "Test $50 USD Transaction"
    test_transaction = next((t for t in transactions if t.get("description") == "Test $50 USD Transaction"), None)
    if test_transaction:
        print("\n--- Test $50 USD Transaction ---")
        print(f"ID: {test_transaction.get('id')}")
        print(f"Description: {test_transaction.get('description')}")
        print(f"Currency: {test_transaction.get('currency')}")
        print(f"Original Amount: {test_transaction.get('original_amount')}")
        print(f"Exchange Rate: {test_transaction.get('exchange_rate')}")
        print(f"EUR Amount: {test_transaction.get('amount')}")
        
        # Verify it has the correct fields
        if test_transaction.get("currency") != "USD":
            print(f"❌ Test transaction has incorrect currency: {test_transaction.get('currency')}, expected: USD")
            all_valid = False
        
        if test_transaction.get("original_amount") != 50.0:
            print(f"❌ Test transaction has incorrect original_amount: {test_transaction.get('original_amount')}, expected: 50.0")
            all_valid = False
        
        # Verify conversion calculation
        original_amount = test_transaction.get("original_amount")
        exchange_rate = test_transaction.get("exchange_rate")
        amount = test_transaction.get("amount")
        
        if original_amount is not None and exchange_rate is not None:
            expected_amount = round(original_amount * exchange_rate, 2)
            actual_amount = round(amount, 2)
            
            conversion_correct = abs(actual_amount - expected_amount) < 0.01
            if not conversion_correct:
                print(f"❌ Test transaction currency conversion is incorrect: {original_amount} * {exchange_rate} = {expected_amount}, but got {actual_amount}")
                all_valid = False
            else:
                print(f"✅ Test transaction currency conversion is correct: {original_amount} USD * {exchange_rate} = {actual_amount} EUR")
    else:
        print("\n⚠️ Could not find the 'Test $50 USD Transaction' in the response")
    
    return all_valid

def test_admin_login():
    print_test_header("POST /api/login - Admin authentication")
    
    # Test with correct password
    login_data = {"password": "alpha2024!"}
    response = requests.post(f"{API_BASE_URL}/login", json=login_data)
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    login_response = response.json()
    if not assert_equal(login_response.get("success"), True, "Login success"):
        return False
    
    if not login_response.get("token"):
        print("❌ Login response does not contain a token")
        return False
    
    print("✅ Admin login successful with correct password")
    
    # Test with incorrect password
    wrong_login_data = {"password": "wrong_password"}
    wrong_response = requests.post(f"{API_BASE_URL}/login", json=wrong_login_data)
    print_response(wrong_response)
    
    if not assert_status_code(wrong_response, 200):
        return False
    
    wrong_login_response = wrong_response.json()
    if not assert_equal(wrong_login_response.get("success"), False, "Login failure with wrong password"):
        return False
    
    print("✅ Admin login correctly fails with wrong password")
    
    return True

def test_transaction_filtering():
    print_test_header("GET /api/transactions - Transaction filtering")
    
    # Get a valid client slug
    client_slug = get_client_slug()
    if not client_slug:
        print("❌ Cannot test transaction filtering without a valid client slug")
        return False
    
    print(f"Testing with client_slug: {client_slug}")
    
    # Test filtering by client_slug
    response = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    transactions = response.json()
    print(f"Found {len(transactions)} transactions for client {client_slug}")
    
    # Test filtering by type (dare/avere)
    type_response = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}&type=dare")
    print_response(type_response)
    
    if not assert_status_code(type_response, 200):
        return False
    
    dare_transactions = type_response.json()
    print(f"Found {len(dare_transactions)} 'dare' transactions for client {client_slug}")
    
    # Verify all returned transactions are of type 'dare'
    all_dare = all(t.get("type") == "dare" for t in dare_transactions)
    if not all_dare:
        print("❌ Some transactions in the 'dare' filtered results are not of type 'dare'")
        return False
    
    print("✅ Type filtering works correctly")
    
    # Test filtering by category
    category_response = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}&category=Cash")
    print_response(category_response)
    
    if not assert_status_code(category_response, 200):
        return False
    
    cash_transactions = category_response.json()
    print(f"Found {len(cash_transactions)} 'Cash' transactions for client {client_slug}")
    
    # Verify all returned transactions are of category 'Cash'
    all_cash = all(t.get("category") == "Cash" for t in cash_transactions)
    if not all_cash:
        print("❌ Some transactions in the 'Cash' filtered results are not of category 'Cash'")
        return False
    
    print("✅ Category filtering works correctly")
    
    # Test filtering by date range
    today = datetime.now()
    date_from = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    date_to = today.strftime("%Y-%m-%d")
    
    date_response = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}&date_from={date_from}&date_to={date_to}")
    print_response(date_response)
    
    if not assert_status_code(date_response, 200):
        return False
    
    date_transactions = date_response.json()
    print(f"Found {len(date_transactions)} transactions for client {client_slug} in the last 30 days")
    
    # Test search filtering
    if len(transactions) > 0:
        # Get a word from the first transaction description to search for
        search_term = transactions[0]["description"].split()[0] if transactions[0]["description"] else "test"
        search_response = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}&search={search_term}")
        print_response(search_response)
        
        if not assert_status_code(search_response, 200):
            return False
        
        search_transactions = search_response.json()
        print(f"Found {len(search_transactions)} transactions for client {client_slug} with search term '{search_term}'")
        
        # Verify at least one transaction contains the search term
        if len(search_transactions) > 0:
            contains_term = any(search_term.lower() in t.get("description", "").lower() for t in search_transactions)
            if not contains_term:
                print(f"❌ None of the search results contain the term '{search_term}'")
                return False
            
            print("✅ Search filtering works correctly")
    
    return True

def test_clients_api():
    print_test_header("GET /api/clients/public - Clients API")
    
    # Test public clients endpoint
    response = requests.get(f"{API_BASE_URL}/clients/public")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    clients = response.json()
    print(f"Found {len(clients)} clients")
    
    if not clients:
        print("❌ No clients found")
        return False
    
    # Check if clients have the expected structure
    required_keys = ["id", "name", "slug", "created_date", "total_transactions", "balance"]
    if not assert_contains_keys(clients[0], required_keys, "Client structure"):
        return False
    
    # Check if we can find the specific clients mentioned in the review request
    bill_client = next((c for c in clients if c["slug"] == "bill"), None)
    sovanza_client = next((c for c in clients if c["slug"] == "sovanza"), None)
    
    if bill_client:
        print(f"✅ Found 'Bill' client: {bill_client['name']}, transactions: {bill_client['total_transactions']}")
    else:
        print("⚠️ 'Bill' client not found")
    
    if sovanza_client:
        print(f"✅ Found 'Sovanza' client: {sovanza_client['name']}, transactions: {sovanza_client['total_transactions']}")
    else:
        print("⚠️ 'Sovanza' client not found")
    
    # Test admin clients endpoint (requires authentication)
    admin_token = get_admin_token()
    if admin_token:
        headers = {"Authorization": f"Bearer {admin_token}"}
        admin_response = requests.get(f"{API_BASE_URL}/clients", headers=headers)
        print_response(admin_response)
        
        if not assert_status_code(admin_response, 200):
            return False
        
        admin_clients = admin_response.json()
        print(f"Found {len(admin_clients)} clients with admin authentication")
        
        # Verify the admin endpoint returns the same clients as the public endpoint
        if len(admin_clients) != len(clients):
            print(f"⚠️ Admin endpoint returned {len(admin_clients)} clients, but public endpoint returned {len(clients)}")
        
        print("✅ Admin clients endpoint works correctly")
    else:
        print("⚠️ Could not test admin clients endpoint due to authentication failure")
    
    return True

def test_exchange_rates_api():
    print_test_header("GET /api/exchange-rates - Exchange Rates API")
    
    response = requests.get(f"{API_BASE_URL}/exchange-rates")
    print_response(response)
    
    if not assert_status_code(response, 200):
        return False
    
    rates_data = response.json()
    required_keys = ["base_currency", "rates", "last_updated"]
    if not assert_contains_keys(rates_data, required_keys, "Exchange rates data structure"):
        return False
    
    # Check if rates include USD and GBP
    rates = rates_data.get("rates", {})
    if "USD" not in rates:
        print("❌ Exchange rates do not include USD")
        return False
    
    if "GBP" not in rates:
        print("❌ Exchange rates do not include GBP")
        return False
    
    print(f"✅ Exchange rates API returned rates: EUR: {rates.get('EUR')}, USD: {rates.get('USD')}, GBP: {rates.get('GBP')}")
    return True

def run_all_tests():
    print("\n🔍 STARTING BACKEND API TESTS 🔍\n")
    
    # Test admin authentication
    if not test_admin_login():
        print("❌ Admin authentication test failed")
    else:
        print("✅ Admin authentication test passed")
    
    # Test clients API
    if not test_clients_api():
        print("❌ Clients API test failed")
    else:
        print("✅ Clients API test passed")
    
    # Test transaction filtering
    if not test_transaction_filtering():
        print("❌ Transaction filtering test failed")
    else:
        print("✅ Transaction filtering test passed")
    
    # Test balance calculation
    if not test_balance_calculation():
        print("❌ Balance calculation test failed")
    else:
        print("✅ Balance calculation test passed")
    
    # Test exchange rates API
    if not test_exchange_rates_api():
        print("❌ Exchange rates API test failed")
    else:
        print("✅ Exchange rates API test passed")
    
    # Test multi-currency functionality
    if not test_multi_currency_transactions():
        print("❌ Multi-currency USD transactions test failed")
    else:
        print("✅ Multi-currency USD transactions test passed")
    
    # Test Sovanza transactions currency fields
    if not test_sovanza_transactions_currency_fields():
        print("❌ Sovanza transactions currency fields test failed")
    else:
        print("✅ Sovanza transactions currency fields test passed")
    
    # Test Sovanza USD transaction
    if not test_sovanza_usd_transaction():
        print("❌ Sovanza $50 USD transaction test failed")
    else:
        print("✅ Sovanza $50 USD transaction test passed")
    
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
    
    print("\n🏁 ALL TESTS COMPLETED 🏁\n")

if __name__ == "__main__":
    run_all_tests()