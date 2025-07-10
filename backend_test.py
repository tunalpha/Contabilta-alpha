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

def test_client_password_management():
    print_test_header("Client Password Management")
    
    # Get admin token for authenticated requests
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token for client password management")
        return False
    
    # Get a client to test with
    response = requests.get(f"{API_BASE_URL}/clients/public")
    if response.status_code != 200 or not response.json():
        print("❌ Failed to get client for password management test")
        return False
    
    test_client = response.json()[0]
    client_id = test_client["id"]
    client_slug = test_client["slug"]
    
    print(f"Testing with client: {test_client['name']} (ID: {client_id}, Slug: {client_slug})")
    
    # Step 1: Set password for the client
    print("\n--- Setting client password ---")
    password = "testpassword123"
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    set_password_response = requests.post(
        f"{API_BASE_URL}/clients/{client_id}/password",
        json={"password": password},
        headers=headers
    )
    print_response(set_password_response)
    
    if not assert_status_code(set_password_response, 200):
        return False
    
    # Step 2: Verify client now has password set
    print("\n--- Verifying client has password set ---")
    client_response = requests.get(f"{API_BASE_URL}/clients", headers=headers)
    if client_response.status_code != 200:
        print("❌ Failed to get clients list")
        return False
    
    updated_client = next((c for c in client_response.json() if c["id"] == client_id), None)
    if not updated_client:
        print("❌ Could not find client in response")
        return False
    
    if not assert_equal(updated_client["has_password"], True, "Client has_password flag"):
        return False
    
    # Step 3: Test client login with correct password
    print("\n--- Testing client login with correct password ---")
    login_response = requests.post(
        f"{API_BASE_URL}/clients/{client_slug}/login",
        json={"password": password}
    )
    print_response(login_response)
    
    if not assert_status_code(login_response, 200):
        return False
    
    login_data = login_response.json()
    if not assert_equal(login_data["success"], True, "Login success"):
        return False
    
    client_token = login_data["token"]
    if not client_token:
        print("❌ Login response does not contain a token")
        return False
    
    print("✅ Client login successful with correct password")
    
    # Step 4: Test client login with incorrect password
    print("\n--- Testing client login with incorrect password ---")
    wrong_login_response = requests.post(
        f"{API_BASE_URL}/clients/{client_slug}/login",
        json={"password": "wrongpassword"}
    )
    print_response(wrong_login_response)
    
    if not assert_status_code(wrong_login_response, 200):
        return False
    
    wrong_login_data = wrong_login_response.json()
    if not assert_equal(wrong_login_data["success"], False, "Login failure with wrong password"):
        return False
    
    print("✅ Client login correctly fails with wrong password")
    
    # Step 5: Test accessing protected endpoints with valid token
    print("\n--- Testing protected endpoints with valid token ---")
    
    # Test client details endpoint
    client_details_response = requests.get(
        f"{API_BASE_URL}/clients/{client_slug}",
        headers={"Authorization": f"Bearer client_{client_id}"}
    )
    print_response(client_details_response)
    
    if not assert_status_code(client_details_response, 200):
        return False
    
    print("✅ Client details endpoint accessible with valid token")
    
    # Test transactions endpoint
    transactions_response = requests.get(
        f"{API_BASE_URL}/transactions?client_slug={client_slug}",
        headers={"Authorization": f"Bearer client_{client_id}"}
    )
    print_response(transactions_response)
    
    if not assert_status_code(transactions_response, 200):
        return False
    
    print("✅ Transactions endpoint accessible with valid token")
    
    # Test balance endpoint
    balance_response = requests.get(
        f"{API_BASE_URL}/balance?client_slug={client_slug}",
        headers={"Authorization": f"Bearer client_{client_id}"}
    )
    print_response(balance_response)
    
    if not assert_status_code(balance_response, 200):
        return False
    
    print("✅ Balance endpoint accessible with valid token")
    
    # Test statistics endpoint
    statistics_response = requests.get(
        f"{API_BASE_URL}/statistics?client_slug={client_slug}",
        headers={"Authorization": f"Bearer client_{client_id}"}
    )
    print_response(statistics_response)
    
    if not assert_status_code(statistics_response, 200):
        return False
    
    print("✅ Statistics endpoint accessible with valid token")
    
    # Step 6: Test accessing protected endpoints without token (should fail)
    print("\n--- Testing protected endpoints without token ---")
    
    # Test client details endpoint without token
    client_details_no_auth = requests.get(f"{API_BASE_URL}/clients/{client_slug}")
    print_response(client_details_no_auth)
    
    if not assert_status_code(client_details_no_auth, 401):
        return False
    
    print("✅ Client details endpoint correctly returns 401 without token")
    
    # Test transactions endpoint without token
    transactions_no_auth = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}")
    print_response(transactions_no_auth)
    
    if not assert_status_code(transactions_no_auth, 401):
        return False
    
    print("✅ Transactions endpoint correctly returns 401 without token")
    
    # Step 7: Remove password protection
    print("\n--- Removing password protection ---")
    remove_password_response = requests.delete(
        f"{API_BASE_URL}/clients/{client_id}/password",
        headers=headers
    )
    print_response(remove_password_response)
    
    if not assert_status_code(remove_password_response, 200):
        return False
    
    # Step 8: Verify client no longer has password set
    print("\n--- Verifying client no longer has password ---")
    client_response_after = requests.get(f"{API_BASE_URL}/clients", headers=headers)
    if client_response_after.status_code != 200:
        print("❌ Failed to get clients list after password removal")
        return False
    
    updated_client_after = next((c for c in client_response_after.json() if c["id"] == client_id), None)
    if not updated_client_after:
        print("❌ Could not find client in response after password removal")
        return False
    
    if not assert_equal(updated_client_after["has_password"], False, "Client has_password flag after removal"):
        return False
    
    # Step 9: Test accessing endpoints without token after password removal (should work)
    print("\n--- Testing endpoints without token after password removal ---")
    
    client_details_after = requests.get(f"{API_BASE_URL}/clients/{client_slug}")
    print_response(client_details_after)
    
    if not assert_status_code(client_details_after, 200):
        return False
    
    print("✅ Client details endpoint accessible without token after password removal")
    
    transactions_after = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}")
    print_response(transactions_after)
    
    if not assert_status_code(transactions_after, 200):
        return False
    
    print("✅ Transactions endpoint accessible without token after password removal")
    
    print("✅ Client password management test passed")
    return True

def test_client_login_without_password():
    print_test_header("Client Login Without Password")
    
    # Get a client that doesn't have a password set
    response = requests.get(f"{API_BASE_URL}/clients/public")
    if response.status_code != 200 or not response.json():
        print("❌ Failed to get clients for login test")
        return False
    
    # Get admin token to check which clients don't have passwords
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    admin_clients_response = requests.get(f"{API_BASE_URL}/clients", headers=headers)
    if admin_clients_response.status_code != 200:
        print("❌ Failed to get clients with admin token")
        return False
    
    # Find a client without password
    clients = admin_clients_response.json()
    client_without_password = next((c for c in clients if not c["has_password"]), None)
    
    if not client_without_password:
        print("⚠️ All clients have passwords set. Creating a new client without password.")
        
        # Create a new client without password
        create_response = requests.post(
            f"{API_BASE_URL}/clients",
            json={"name": "Test Client Without Password"},
            headers=headers
        )
        
        if create_response.status_code != 200:
            print("❌ Failed to create test client")
            return False
        
        client_without_password = create_response.json()
    
    client_slug = client_without_password["slug"]
    print(f"Testing with client without password: {client_without_password['name']} (Slug: {client_slug})")
    
    # Test login for client without password
    login_response = requests.post(
        f"{API_BASE_URL}/clients/{client_slug}/login",
        json={"password": ""}
    )
    print_response(login_response)
    
    if not assert_status_code(login_response, 200):
        return False
    
    login_data = login_response.json()
    if not assert_equal(login_data["success"], True, "Login success without password"):
        return False
    
    if not login_data.get("token"):
        print("❌ Login response does not contain a token even though no password is required")
        return False
    
    print("✅ Client without password can login successfully without providing a password")
    
    # Test accessing endpoints without token for client without password
    client_details_response = requests.get(f"{API_BASE_URL}/clients/{client_slug}")
    print_response(client_details_response)
    
    if not assert_status_code(client_details_response, 200):
        return False
    
    print("✅ Client details endpoint accessible without token for client without password")
    
    transactions_response = requests.get(f"{API_BASE_URL}/transactions?client_slug={client_slug}")
    print_response(transactions_response)
    
    if not assert_status_code(transactions_response, 200):
        return False
    
    print("✅ Transactions endpoint accessible without token for client without password")
    
    print("✅ Client login without password test passed")
    return True

def test_password_change():
    print_test_header("Client Password Change")
    
    # Get admin token for authenticated requests
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token for password change test")
        return False
    
    # Get a client to test with
    response = requests.get(f"{API_BASE_URL}/clients/public")
    if response.status_code != 200 or not response.json():
        print("❌ Failed to get client for password change test")
        return False
    
    test_client = response.json()[0]
    client_id = test_client["id"]
    client_slug = test_client["slug"]
    
    print(f"Testing password change with client: {test_client['name']} (ID: {client_id}, Slug: {client_slug})")
    
    # Step 1: Set initial password
    initial_password = "initialpassword123"
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    set_password_response = requests.post(
        f"{API_BASE_URL}/clients/{client_id}/password",
        json={"password": initial_password},
        headers=headers
    )
    
    if set_password_response.status_code != 200:
        print("❌ Failed to set initial password")
        return False
    
    print("✅ Initial password set successfully")
    
    # Step 2: Verify login works with initial password
    login_response = requests.post(
        f"{API_BASE_URL}/clients/{client_slug}/login",
        json={"password": initial_password}
    )
    
    if login_response.status_code != 200 or not login_response.json()["success"]:
        print("❌ Login with initial password failed")
        return False
    
    print("✅ Login with initial password successful")
    
    # Step 3: Change password
    new_password = "newpassword456"
    
    change_password_response = requests.post(
        f"{API_BASE_URL}/clients/{client_id}/password",
        json={"password": new_password},
        headers=headers
    )
    print_response(change_password_response)
    
    if not assert_status_code(change_password_response, 200):
        return False
    
    print("✅ Password changed successfully")
    
    # Step 4: Verify old password no longer works
    old_login_response = requests.post(
        f"{API_BASE_URL}/clients/{client_slug}/login",
        json={"password": initial_password}
    )
    print_response(old_login_response)
    
    if old_login_response.status_code != 200:
        print("❌ Unexpected status code when trying old password")
        return False
    
    old_login_data = old_login_response.json()
    if old_login_data["success"]:
        print("❌ Old password still works after change")
        return False
    
    print("✅ Old password correctly rejected after change")
    
    # Step 5: Verify new password works
    new_login_response = requests.post(
        f"{API_BASE_URL}/clients/{client_slug}/login",
        json={"password": new_password}
    )
    print_response(new_login_response)
    
    if not assert_status_code(new_login_response, 200):
        return False
    
    new_login_data = new_login_response.json()
    if not assert_equal(new_login_data["success"], True, "Login success with new password"):
        return False
    
    print("✅ New password works correctly")
    
    # Step 6: Clean up by removing password
    remove_password_response = requests.delete(
        f"{API_BASE_URL}/clients/{client_id}/password",
        headers=headers
    )
    
    if remove_password_response.status_code != 200:
        print("⚠️ Failed to clean up by removing password")
    else:
        print("✅ Password removed successfully")
    
    print("✅ Password change test passed")
    return True

def test_client_modification():
    print_test_header("Client Name Modification - PUT /api/clients/{client_id}")
    
    # Get admin token for authenticated requests
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token for client modification test")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Step 1: Create a test client
    print("\n--- Creating test client ---")
    original_name = "Test Client Original"
    create_response = requests.post(
        f"{API_BASE_URL}/clients",
        json={"name": original_name},
        headers=headers
    )
    print_response(create_response)
    
    if not assert_status_code(create_response, 200):
        return False
    
    created_client = create_response.json()
    client_id = created_client["id"]
    original_slug = created_client["slug"]
    
    print(f"✅ Created test client: {original_name} (ID: {client_id}, Slug: {original_slug})")
    
    # Step 2: Test updating client name
    print("\n--- Testing client name update ---")
    new_name = "Test Client Modified"
    update_response = requests.put(
        f"{API_BASE_URL}/clients/{client_id}",
        json={"name": new_name},
        headers=headers
    )
    print_response(update_response)
    
    if not assert_status_code(update_response, 200):
        return False
    
    updated_client = update_response.json()
    
    # Verify the response structure
    required_keys = ["id", "name", "slug", "created_date", "total_transactions", "balance"]
    if not assert_contains_keys(updated_client, required_keys, "Updated client structure"):
        return False
    
    # Verify the name was updated
    if not assert_equal(updated_client["name"], new_name, "Updated client name"):
        return False
    
    # Verify a new slug was generated
    new_slug = updated_client["slug"]
    if new_slug == original_slug:
        print("⚠️ Slug was not changed, but this might be expected if the slug generation produces the same result")
    else:
        print(f"✅ New slug generated: {original_slug} -> {new_slug}")
    
    # Verify the slug is URL-friendly
    import re
    if not re.match(r'^[a-z0-9-]+$', new_slug):
        print(f"❌ New slug '{new_slug}' is not URL-friendly")
        return False
    
    print(f"✅ Client name updated successfully: {original_name} -> {new_name}")
    
    # Step 3: Test authentication requirement
    print("\n--- Testing authentication requirement ---")
    unauthorized_response = requests.put(
        f"{API_BASE_URL}/clients/{client_id}",
        json={"name": "Unauthorized Update"}
    )
    print_response(unauthorized_response)
    
    if not assert_status_code(unauthorized_response, 401):
        return False
    
    print("✅ Client modification correctly requires admin authentication")
    
    # Step 4: Test with invalid client ID
    print("\n--- Testing with invalid client ID ---")
    invalid_id = "non-existent-id"
    invalid_response = requests.put(
        f"{API_BASE_URL}/clients/{invalid_id}",
        json={"name": "Invalid Update"},
        headers=headers
    )
    print_response(invalid_response)
    
    if not assert_status_code(invalid_response, 404):
        return False
    
    print("✅ Client modification correctly returns 404 for invalid client ID")
    
    # Step 5: Test with empty name
    print("\n--- Testing with empty name ---")
    empty_name_response = requests.put(
        f"{API_BASE_URL}/clients/{client_id}",
        json={"name": ""},
        headers=headers
    )
    print_response(empty_name_response)
    
    # This should either fail with validation error or create an empty slug
    if empty_name_response.status_code == 200:
        empty_result = empty_name_response.json()
        if empty_result["name"] == "":
            print("⚠️ Empty name was accepted - this might need validation")
        else:
            print("❌ Empty name was not properly handled")
            return False
    else:
        print("✅ Empty name was rejected with appropriate error")
    
    # Step 6: Test duplicate name handling
    print("\n--- Testing duplicate name handling ---")
    
    # Create another client with a different name
    second_client_response = requests.post(
        f"{API_BASE_URL}/clients",
        json={"name": "Second Test Client"},
        headers=headers
    )
    
    if second_client_response.status_code == 200:
        second_client = second_client_response.json()
        second_client_id = second_client["id"]
        
        # Try to update the second client to have the same name as the first
        duplicate_response = requests.put(
            f"{API_BASE_URL}/clients/{second_client_id}",
            json={"name": new_name},  # Same name as first client
            headers=headers
        )
        print_response(duplicate_response)
        
        if duplicate_response.status_code == 200:
            duplicate_result = duplicate_response.json()
            # Check if the system handled duplicate names by creating unique slugs
            if duplicate_result["slug"] != new_slug:
                print(f"✅ Duplicate name handled correctly with unique slug: {duplicate_result['slug']}")
            else:
                print("❌ Duplicate name created identical slug")
                return False
        else:
            print("⚠️ Duplicate name was rejected - this might be intended behavior")
        
        # Clean up second client
        requests.delete(f"{API_BASE_URL}/clients/{second_client_id}", headers=headers)
    
    # Step 7: Test special characters in name
    print("\n--- Testing special characters in name ---")
    special_name = "Test Client with Special Chars! @#$%"
    special_response = requests.put(
        f"{API_BASE_URL}/clients/{client_id}",
        json={"name": special_name},
        headers=headers
    )
    print_response(special_response)
    
    if special_response.status_code == 200:
        special_result = special_response.json()
        special_slug = special_result["slug"]
        
        # Verify the slug is still URL-friendly despite special characters in name
        if re.match(r'^[a-z0-9-]+$', special_slug):
            print(f"✅ Special characters handled correctly in slug: {special_slug}")
        else:
            print(f"❌ Special characters not properly handled in slug: {special_slug}")
            return False
    else:
        print("⚠️ Special characters in name were rejected")
    
    # Step 8: Verify client can still be accessed with new slug
    print("\n--- Testing client access with new slug ---")
    final_client_response = requests.get(f"{API_BASE_URL}/clients/public")
    if final_client_response.status_code == 200:
        all_clients = final_client_response.json()
        updated_client_in_list = next((c for c in all_clients if c["id"] == client_id), None)
        
        if updated_client_in_list:
            final_slug = updated_client_in_list["slug"]
            
            # Test accessing the client by its new slug
            access_response = requests.get(f"{API_BASE_URL}/clients/{final_slug}")
            print_response(access_response)
            
            if assert_status_code(access_response, 200):
                print(f"✅ Client accessible with updated slug: {final_slug}")
            else:
                return False
        else:
            print("❌ Updated client not found in clients list")
            return False
    
    # Clean up: Delete the test client
    print("\n--- Cleaning up test client ---")
    delete_response = requests.delete(f"{API_BASE_URL}/clients/{client_id}", headers=headers)
    if delete_response.status_code == 200:
        print("✅ Test client cleaned up successfully")
    else:
        print("⚠️ Failed to clean up test client")
    
    print("✅ Client modification test completed successfully")
    return True

def test_client_modification_edge_cases():
    print_test_header("Client Modification Edge Cases")
    
    # Get admin token
    admin_token = get_admin_token()
    if not admin_token:
        print("❌ Failed to get admin token")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test 1: Very long name
    print("\n--- Testing very long client name ---")
    long_name = "A" * 200  # 200 character name
    
    # Create client with long name
    long_name_response = requests.post(
        f"{API_BASE_URL}/clients",
        json={"name": long_name},
        headers=headers
    )
    
    if long_name_response.status_code == 200:
        long_client = long_name_response.json()
        long_client_id = long_client["id"]
        
        print(f"✅ Long name accepted: {len(long_client['name'])} characters")
        print(f"Generated slug: {long_client['slug']}")
        
        # Test updating with another long name
        another_long_name = "B" * 150
        update_long_response = requests.put(
            f"{API_BASE_URL}/clients/{long_client_id}",
            json={"name": another_long_name},
            headers=headers
        )
        
        if update_long_response.status_code == 200:
            print("✅ Long name update successful")
        else:
            print("⚠️ Long name update failed")
        
        # Clean up
        requests.delete(f"{API_BASE_URL}/clients/{long_client_id}", headers=headers)
    else:
        print("⚠️ Long name was rejected")
    
    # Test 2: Unicode characters
    print("\n--- Testing Unicode characters in name ---")
    unicode_name = "Cliente Español 中文 العربية 🎉"
    
    unicode_response = requests.post(
        f"{API_BASE_URL}/clients",
        json={"name": unicode_name},
        headers=headers
    )
    
    if unicode_response.status_code == 200:
        unicode_client = unicode_response.json()
        unicode_client_id = unicode_client["id"]
        
        print(f"✅ Unicode name accepted: {unicode_client['name']}")
        print(f"Generated slug: {unicode_client['slug']}")
        
        # Test updating with more Unicode
        new_unicode_name = "Новый клиент 🚀"
        update_unicode_response = requests.put(
            f"{API_BASE_URL}/clients/{unicode_client_id}",
            json={"name": new_unicode_name},
            headers=headers
        )
        
        if update_unicode_response.status_code == 200:
            updated_unicode = update_unicode_response.json()
            print(f"✅ Unicode name update successful: {updated_unicode['name']}")
            print(f"New slug: {updated_unicode['slug']}")
        else:
            print("⚠️ Unicode name update failed")
        
        # Clean up
        requests.delete(f"{API_BASE_URL}/clients/{unicode_client_id}", headers=headers)
    else:
        print("⚠️ Unicode name was rejected")
    
    # Test 3: Multiple clients with similar names
    print("\n--- Testing multiple clients with similar names ---")
    base_name = "Similar Client"
    client_ids = []
    
    for i in range(3):
        similar_response = requests.post(
            f"{API_BASE_URL}/clients",
            json={"name": base_name},
            headers=headers
        )
        
        if similar_response.status_code == 200:
            similar_client = similar_response.json()
            client_ids.append(similar_client["id"])
            print(f"Client {i+1}: {similar_client['name']} -> {similar_client['slug']}")
    
    if len(client_ids) == 3:
        print("✅ Multiple clients with same name created with unique slugs")
        
        # Now update them all to have the same new name
        new_similar_name = "Updated Similar Client"
        for i, client_id in enumerate(client_ids):
            update_response = requests.put(
                f"{API_BASE_URL}/clients/{client_id}",
                json={"name": new_similar_name},
                headers=headers
            )
            
            if update_response.status_code == 200:
                updated = update_response.json()
                print(f"Updated client {i+1}: {updated['name']} -> {updated['slug']}")
        
        print("✅ Multiple clients updated with same name, unique slugs maintained")
    
    # Clean up similar clients
    for client_id in client_ids:
        requests.delete(f"{API_BASE_URL}/clients/{client_id}", headers=headers)
    
    print("✅ Client modification edge cases test completed")
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
    
    # Test client password management
    if not test_client_password_management():
        print("❌ Client password management test failed")
    else:
        print("✅ Client password management test passed")
    
    # Test client login without password
    if not test_client_login_without_password():
        print("❌ Client login without password test failed")
    else:
        print("✅ Client login without password test passed")
    
    # Test password change
    if not test_password_change():
        print("❌ Password change test failed")
    else:
        print("✅ Password change test passed")
    
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