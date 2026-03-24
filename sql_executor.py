

######################### connecting using Managed Identity #########################


import pyodbc
from azure.identity import ManagedIdentityCredential, AzureCliCredential, ChainedTokenCredential
from datetime import datetime
from typing import List, Dict, Any
import struct
import logging
import time
import os
from openai import AzureOpenAI  



# Suppress Azure Identity verbose logging
logging.getLogger('azure.identity').setLevel(logging.ERROR)
logging.getLogger('azure.core.pipeline.policies.http_logging_policy').setLevel(logging.ERROR)

# Enable ODBC connection pooling
pyodbc.pooling = True

# Global token cache
_token_cache = {
    "token": None,
    "expires_at": 0
}

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------
FABRIC_SERVER = os.getenv("FABRIC_SERVER")
FABRIC_DATABASE = os.getenv("FABRIC_DATABASE")

# For User-Assigned MI only (leave unset for System-Assigned MI)
MANAGED_IDENTITY_CLIENT_ID = os.getenv("AZURE_CLIENT_ID")

# ------------------------------------------------------------------------------
# Get Fabric Access Token
# ------------------------------------------------------------------------------
def get_fabric_token(force_refresh: bool = False) -> str:
    """
    Get Microsoft Fabric access token.
    
    Authentication Chain:
    1. Managed Identity (System or User-Assigned) - for Azure environments
    2. Azure CLI - for local/Docker development
    
    Args:
        force_refresh: Force token refresh even if cached token is valid
    
    Returns:
        str: Valid access token
    """
    global _token_cache
    now = time.time()

    # Return cached token if still valid (5 min buffer before expiration)
    if not force_refresh and _token_cache["token"] and now < (_token_cache["expires_at"] - 300):
        expires_in_min = (_token_cache["expires_at"] - now) / 60
        print(f"[Token] Using cached token (expires in {expires_in_min:.1f} min)")
        return _token_cache["token"]

    print("[Token] Acquiring new token...")
    
    try:
        credentials = []
        
        # 1. Add Managed Identity credential (System or User-Assigned)
        if MANAGED_IDENTITY_CLIENT_ID:
            print(f"[Token] Using User-Assigned MI: {MANAGED_IDENTITY_CLIENT_ID}")
            credentials.append(ManagedIdentityCredential(client_id=MANAGED_IDENTITY_CLIENT_ID))
        else:
            print("[Token] Using System-Assigned MI")
            credentials.append(ManagedIdentityCredential())
        
        # 2. Add Azure CLI as fallback for local development
        credentials.append(AzureCliCredential())
        
        # Create chained credential (tries in order)
        credential = ChainedTokenCredential(*credentials)
        
        # Get token for Microsoft Fabric
        token = credential.get_token("https://analysis.windows.net/powerbi/api/.default")
        
        # Cache the token
        _token_cache["token"] = token.token
        _token_cache["expires_at"] = token.expires_on
        
        expires_in_min = (token.expires_on - now) / 60
        print(f"[Token] ✓ Token acquired (expires in {expires_in_min:.1f} min)")
        
        return token.token
        
    except Exception as e:
        print(f"[Token] ✗ ERROR: {str(e)}")
        print("\n[Token] Troubleshooting:")
        print("  • Azure Web App: Enable System-Assigned MI in Portal → Identity")
        print("  • Azure Web App: Grant MI 'Contributor' role on Fabric workspace")
        print("  • Local/Docker: Run 'az login' in terminal before starting app")
        print("  • Docker: Mount credentials with -v ~/.azure:/root/.azure:ro")
        raise Exception(f"Authentication failed: {str(e)}")

# ------------------------------------------------------------------------------
# Create Fabric SQL Connection
# ------------------------------------------------------------------------------
def get_fabric_connection(retry: int = 0) -> pyodbc.Connection:
    """
    Create connection to Microsoft Fabric SQL Endpoint using token authentication.

    Returns:
        pyodbc.Connection: Active database connection

    Raises:
        Exception: If connection fails
    """
    try:
        print(f"[Connection] Connecting to {FABRIC_SERVER}/{FABRIC_DATABASE}")

        # Get access token
        token_str = get_fabric_token()

        # Convert token to ODBC format (SQL_COPT_SS_ACCESS_TOKEN)
        token_bytes = token_str.encode("utf-16-le")
        token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)

        # Build connection string
        connection_string = (
            f"DRIVER={{ODBC Driver 18 for SQL Server}};"
            f"SERVER={FABRIC_SERVER};"
            f"DATABASE={FABRIC_DATABASE};"
            f"PORT=1433;"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;"
        )

        # Establish connection with token authentication
        # 1256 = SQL_COPT_SS_ACCESS_TOKEN
        conn = pyodbc.connect(
            connection_string,
            attrs_before={1256: token_struct},
            timeout=30
        )

        print("[Connection] ✓ Connected successfully")
        return conn

    except pyodbc.Error as e:
        # Retry once if token/auth error
        if retry < 1 and ("token" in str(e).lower() or "authentication" in str(e).lower()):
            print("[Connection] Token error detected, retrying with fresh token...")
            _token_cache["token"] = None
            _token_cache["expires_at"] = 0
            return get_fabric_connection(retry=retry + 1)

        print(f"[Connection] ✗ Connection failed: {str(e)}")
        raise Exception(f"Fabric connection failed: {str(e)}")

    except Exception as e:
        print(f"[Connection] ✗ Unexpected error: {str(e)}")
        raise Exception(f"Connection error: {str(e)}")

# ------------------------------------------------------------------------------
# Execute SQL Query
# ------------------------------------------------------------------------------
def execute_sql_query(sql_query: str) -> List[Dict[str, Any]]:
    """
    Execute SQL query(ies) against Microsoft Fabric warehouse.
    Supports multiple SELECT statements separated by semicolons.
    
    Args:
        sql_query: SQL SELECT query or queries (semicolon-separated)
    
    Returns:
        List[Dict[str, Any]]: Query results as list of dictionaries
    
    Raises:
        Exception: If query execution fails after retries
    """
    # print(f"Query from agent: {sql_query}")
    max_retries = 2
    retry_count = 0

    while retry_count < max_retries:
        try:
            print(f"[Query] Attempt {retry_count + 1}/{max_retries}")
            print(f"[Query] SQL Preview: {sql_query}")
            
            # Get database connection
            conn = get_fabric_connection()
            cursor = conn.cursor()

            # Split multiple queries by semicolon
            queries = [q.strip() for q in sql_query.split(';') if q.strip()]
            all_results = []

            # Execute each query
            for idx, query in enumerate(queries):
                print(f"[Query] Executing statement {idx + 1}/{len(queries)}")
                cursor.execute(query)
                
                # Get column names
                columns = [col[0] for col in cursor.description]
                
                # Fetch all rows
                rows = cursor.fetchall()
                
                # Convert rows to list of dictionaries
                for row in rows:
                    record = {}
                    for i, col in enumerate(columns):
                        value = row[i]
                        # Handle datetime serialization
                        if isinstance(value, datetime):
                            value = value.strftime('%Y-%m-%d %H:%M:%S')
                        record[col] = value
                    all_results.append(record)

            # Clean up
            cursor.close()
            conn.close()
            
            print(f"[Query] ✓ Fetched {len(all_results)} rows from {len(queries)} statement(s)")
            return all_results

        except pyodbc.Error as e:
            retry_count += 1
            print(f"[Query] ✗ Database error: {str(e)}")
            
            # Retry if token/auth error
            if retry_count < max_retries and ("token" in str(e).lower() or "authentication" in str(e).lower()):
                print("[Query] Retrying with fresh token...")
                _token_cache["token"] = None
                _token_cache["expires_at"] = 0
                continue
            
            raise Exception(f"Database error: {str(e)}")
        
        except Exception as e:
            retry_count += 1
            print(f"[Query] ✗ Unexpected error: {str(e)}")
            
            # Retry if token/auth error
            if retry_count < max_retries and ("token" in str(e).lower() or "authentication" in str(e).lower()):
                print("[Query] Retrying with fresh token...")
                _token_cache["token"] = None
                _token_cache["expires_at"] = 0
                continue
            
            raise Exception(f"Unexpected error: {str(e)}")

    raise Exception("Query execution failed after maximum retries")

# ------------------------------------------------------------------------------
# OpenAI Tool Definition
# ------------------------------------------------------------------------------
def get_sql_tool_definition() -> Dict[str, Any]:
    """
    Returns the OpenAI function tool definition for SQL query execution.
    
    Returns:
        Dict: Tool definition for OpenAI function calling
    """
    return {
        "type": "function",
        "function": {
            "name": "execute_sql_query",
            "description": "Executes a SQL SELECT query against the Microsoft Fabric warehouse and returns the results",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql_query": {
                        "type": "string",
                        "description": "The SQL SELECT query to execute. Must be a valid SELECT statement without markdown formatting."
                    }
                },
                "required": ["sql_query"]
            }
        }
    }
    
    
    