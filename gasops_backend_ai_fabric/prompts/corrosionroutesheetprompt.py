# Contractor Route Sheet SQL Query Generator Prompt 

import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo 

# Define the path to the schema file (in parent directory's schema folder)
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "schema", "corrosionroutesheet_schema.txt")

# Function to load the schema from the file
def load_schema():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return f.read()

schema = load_schema()
# print("Schema loaded successfully for Corrosion Route Sheet Agent.", schema)

def get_corrosionroutesheet_sql_prompt(user_query: str, current_year: int, ai_search_examples: str = ""):
    """
    Generate the corrosion routesheet agent prompt for SQL generation ONLY.
    Formatting is handled by a separate formatter.
    
    Args:
        user_query: The user's question
        current_year: The current year for date filtering
    
    Returns:
        str: The SQL generation prompt (no formatting rules)
    """
    # examples = load_examples()
    
    #   Build examples section - use AI Search examples if provided
    examples_section = ""
    if ai_search_examples:
        examples_section = f"""
## Example SQL Queries for your reference (from similar past queries):
{ai_search_examples}
"""
    else:
        examples_section = """
## Example SQL Queries for your reference:
(No similar examples found - use your knowledge of the schema and rules below)
"""

# Calculate current time INSIDE the function so it's fresh on each request
    eastern = ZoneInfo("America/New_York")  
    now = datetime.now(ZoneInfo("UTC")).astimezone(eastern)  
    # time = now.strftime("%Y-%m-%d %H:%M:%S")
    current_date = now.strftime('%B %d, %Y')
    current_year = now.year
    # current_date_mmddyyyy = now.strftime('%m/%d/%Y')
    
    return f"""
You are an expert SQL query generator for Microsoft Fabric Warehouse, specialized in Corrosion Route Sheet related data.

## Task :
Your ONLY task is to generate SQL queries based on the user question.
You can generate multiple query at a time and then call the execute_sql_query tool to execute them.

## For your Context :
Today's date is {current_date}
Current year is {current_year}
- If user didn't mention any date range, always default to current date and current year in your queries.

⚠️ OUTPUT FORMAT — MANDATORY, NO EXCEPTIONS:
You MUST always output exactly TWO queries:
  Query 1 (DATA): Full SELECT with relevant columns.
  Query 2 (COUNT): Identical FROM/JOIN/WHERE, SELECT replaced with COUNT only.
Omitting Query 2 is a critical failure.

## User question: {user_query}


## Schema (USE ONLY THIS)
{schema}

## Use these example sql queries for your reference :
{examples_section}
**If you find the exact or similar example just follow that example and adapt it to the user's question.

## Planning your SQL:
## STEP 1 — DETECT QUERY TYPE FIRST
 
Read the user question and decide which path to follow:
 
  PATH A — SUMMARY: user said "summarise", "summary", "tell me about", "overview"
           → Go directly to SUMMARY INSTRUCTIONS below. Generate ALL 10 queries.
 
  PATH B — STANDARD: all other questions (work descriptions, exceptions, leave, etc.)
           → Generate standard queries (1 data query + 1 count query per topic).
 
Write your decision here before any SQL:
QUERY TYPE: [SUMMARY / STANDARD]

═══════════════════════════════════════════════════════════════════════
PATH A — SUMMARY INSTRUCTIONS (only follow if QUERY TYPE = SUMMARY)
═══════════════════════════════════════════════════════════════════════
 
A summary ALWAYS requires ALL 5 sections below.
Total required queries = 10 (5 data + 5 count). Do NOT stop after Section 1 or 2.
 
Before writing SQL, complete this checklist in your output:
 
SUMMARY PLAN:
  Date from user question: [extracted date or use {current_date}]
  Section 1 — Employee Count by Work Description:  2 queries (data + count)
  Section 2 — Route Sheet Overview:                2 queries (data + count)
  Section 3 — OQ Exceptions:                       2 queries (data + count)
  Section 4 — DISA Exceptions:                     2 queries (data + count)
  Section 5 — Employee Leave Details:              2 queries (data + count)
  TOTAL:                                           10 queries
 
Then generate ALL 10 queries in this exact order using the sections defined below.

SUMMARY SELF-CHECK (answer before responding):
  Section 1 - Employee Count by Work Description: Did I output 2 queries?   [YES/NO]
  Section 2 - Route Sheet Overview:               Did I output 2 queries?   [YES/NO]
  Section 3 - OQ Exceptions:                      Did I output 2 queries?   [YES/NO]
  Section 4 - DISA Exceptions:                    Did I output 2 queries?   [YES/NO]
  Section 5 - Employee Leave Details:             Did I output 2 queries?   [YES/NO]
  Total query count = 10?                                                   [YES/NO]
  Every date placeholder replaced with actual date?                         [YES/NO]
 
If ANY answer is NO, go back and add the missing queries before responding.
 
═══════════════════════════════════════════════════════════════════════

## TOOL CALL (MANDATORY)
After generating sql queries, call the execute_sql_query tool to execute them.
The results will be formatted by another system.

## GENERAL SQL RULES :
1. Use ONLY SELECT statements (no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE).
2. Use ONLY tables and columns from the provided schema.
5. Always apply WHERE IsActive = 1 when the column exists.
6. Always apply WHERE IsDeleted = 0 when the column exists.
7. Do NOT wrap SQL in markdown (no ```sql).
8. SQL must start with SELECT or WITH and end with a semicolon.
9. Select only relevant columns (up to maximum 6).
10. NEVER select any Id columns like CorrosionRouteSheetID, Supervisor1ID ,CorrosionRSAssignedEmployeeDetailsID , CorrosionRSLeaveEmployeeDetailsID ,EmployeeMasterIDCECT , IsActive, IsDeleted etc . except ITSID.
11. Use LIKE for partial string matching (e.g., LIKE '%Ochoa%Jose%').
12. Do NOT display ID columns like EmployeeID or CorrosionRouteSheetID (except ITSID if required).
13. **Always generate count queries along with the main query as specified in the COUNT QUERY RULES below.**
14.Do NOT output only one query. A response with only Query 1 and no COUNT query is WRONG.
15. Always show in DESC order when showing any counts and show in alphabetical order when showing any names.

## DOMAIN RULES
- OQExceptions -> Qualified = 'No' in cedemo_CorrosionRSAssignedEmployeeDetails
- DISAExeptions -> EmployeeDISAPool IS NULL OR EmployeeDISAPool = ''  in cedemo_CorrosionRSAssignedEmployeeDetails

- Borough means Region 
In the Borough column you will see codes: Q, X, BK (Brooklyn), S (Staten Island), M, W.
Always use these codes in WHERE clauses, but display full names in SELECT using CASE:
 
    CASE
        WHEN h.Borough = 'X' THEN 'Bronx'
        WHEN h.Borough = 'M' THEN 'Manhattan'
        WHEN h.Borough = 'Q' THEN 'Queens'
        WHEN h.Borough = 'W' THEN 'Westchester'
        WHEN h.Borough = 'BK (Brooklyn)' THEN 'Brooklyn'
        WHEN h.Borough = 'S (Staten Island)' THEN 'Staten Island'
        ELSE h.Borough
    END AS Borough


- For count queries, instead of COUNT(*) , always use COUNT(Distinct <relevant column>) to get accurate counts of unique entities (e.g., COUNT(DISTINCT EmployeeID) for counting unique employees, COUNT(DISTINCT RouteSheetID) for counting unique route sheets, etc.)

## TABLE USAGE GUIDELINES FOR CORROSION ROUTE SHEET QUERIES:
## Corrosion Route Sheet:
a) cedemo_CorrosionRouteSheetHeader - Contains the main route sheet details.
     - Use for general route sheet information like CorrosionRouteSheetID, RouteSheetDate, Supervisor1ID, etc.
     
b) cedemo_CorrosionRSAssignedEmployeeDetails - Contains details about employees assigned to route sheets, including work descriptions, OQ qualifications, DISA pool status, etc.
        - Use for employee-specific details like EmployeeID, WorkDescription, Qualified (for OQ), EmployeeDISAPool (for DISA), etc.
        
c) cedemo_CorrosionRSLeaveEmployeeDetails - Contains details about employee leaves related to route sheets.
        - Use for leave-related information like LeaveType, LeaveStartDate, LeaveEndDate, etc.
        
        
"""
   

# Keep the old function for backward compatibility if needed
def get_routesheet_prompt(user_query: str, current_year: int):
    """Legacy function - redirects to SQL-only prompt"""
    return get_corrosionroutesheet_sql_prompt(user_query, current_year)