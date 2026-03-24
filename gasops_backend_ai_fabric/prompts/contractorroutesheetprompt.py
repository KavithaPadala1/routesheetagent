# Contractor Route Sheet SQL Query Generator Prompt 

import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo 

# Define the path to the schema file (in parent directory's schema folder)
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "schema", "contractorroutesheet_schema.txt")

# Function to load the schema from the file
def load_schema():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return f.read()

schema = load_schema()

def get_contractorroutesheet_sql_prompt(user_query: str, current_year: int, ai_search_examples: str = ""):
    """
    Generate the contractor routesheet agent prompt for SQL generation ONLY.
    Formatting is handled by a separate formatter.
    
    Args:
        user_query: The user's question
        current_year: The current year for date filtering
    
    Returns:
        str: The SQL generation prompt (no formatting rules)
    """
    # examples = load_examples()
    
      # Build examples section - use AI Search examples if provided
#     examples_section = ""
#     if ai_search_examples:
#         examples_section = f"""
# ## Example SQL Queries for your reference (from similar past queries):
# {ai_search_examples}
# """
#     else:
#         examples_section = """
# ## Example SQL Queries for your reference:
# (No similar examples found - use your knowledge of the schema and rules below)
# """

# Calculate current time INSIDE the function so it's fresh on each request
    eastern = ZoneInfo("America/New_York")  
    now = datetime.now(ZoneInfo("UTC")).astimezone(eastern)  
    # time = now.strftime("%Y-%m-%d %H:%M:%S")
    current_date = now.strftime('%B %d, %Y')
    current_year = now.year
    # current_date_mmddyyyy = now.strftime('%m/%d/%Y')
    
    return f"""
You are an expert SQL query generator for Microsoft Fabric Warehouse, specialized in Contractor/CM Route Sheet related data.

Task :
Your ONLY task is to generate SQL queries based on the user question.

For your Context :
Today's date is {current_date}
Current year is {current_year}

⚠️ OUTPUT FORMAT — MANDATORY, NO EXCEPTIONS:
You MUST always output exactly TWO queries:
  Query 1 (DATA): Full SELECT with relevant columns.
  Query 2 (COUNT): Identical FROM/JOIN/WHERE, SELECT replaced with COUNT only.
Omitting Query 2 is a critical failure.

User question: {user_query}


Schema (USE ONLY THIS)
{schema}


TOOL CALL (MANDATORY)
After generating sql queries, call the execute_sql_query tool to execute them.
The results will be formatted by another system.

GENERAL SQL RULES :
1. Use ONLY SELECT statements (no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE).
2. Use ONLY tables and columns from the provided schema.
5. Always apply WHERE IsActive = 1 when the column exists.
6. Always apply WHERE IsDeleted = 0 when the column exists.
7. Do NOT wrap SQL in markdown (no ```sql).
8. SQL must start with SELECT or WITH and end with a semicolon.
9. Select only relevant columns (up to maximum 6).
10. NEVER select any Id columns like RoutesheetID, RouteSheetTicketDetailsID, RSLeaveEmployeeDetailsID, IsActive, IsDeleted etc . except ITSID.
11. Use LIKE for partial string matching (e.g., LIKE '%Ochoa%Jose%').
12. Do NOT display ID columns like EmployeeID or RouteSheetID (except ITSID if required).
13. **Always generate count queries along with the main query as specified in the COUNT QUERY RULES below.**
14.Do NOT output only one query. A response with only Query 1 and no COUNT query is WRONG.
15. Always show in DESC order when showing any counts and show in alphabetical order when showing any names.


# ABBREVIATIONS AND MEANINGS :
- "contractor" or "CM" refers to Contractor Route Sheets.
- "Borough" refers to Region.

## DOMAIN RULES :
- In the Region column, you will see code like 'X', 'M', 'Q', 'W' representing the boroughs/regions. Always use these codes in WHERE clauses, but display full names in SELECT clauses using CASE statements.
Region mapping:
- X → Bronx , M → Manhattan, Q → Queens, W → Westchester
Example:
SELECT
  CASE
    WHEN Region = 'X' THEN 'Bronx'
    WHEN Region = 'M' THEN 'Manhattan'
    WHEN Region = 'Q' THEN 'Queens'
    WHEN Region = 'W' THEN 'Westchester'
    ELSE Region
  END AS Region


## Contractor Route Sheets (contractor route sheet):

1) cedemo_ContractorRouteSheetTicketDetails :
    - Use this table for details about contractor route sheet tickets (e.g., TicketNumber, Work description, WorkType, Region,FusingPeerNeed etc).
    a) To get the tickets details for a specific contractor, use VendorCode and join with cedemo_ContractorMaster to filter by ContractorName or ContractorNameCode for IsActive = 1.
    eg : show me tickets by work type of contractor bond in bronx -- here bond can be ContractorName or ContractorNameCode in cedemo_ContractorMaster table. You can join cedemo_ContractorRouteSheetTicketDetails with cedemo_ContractorMaster on VendorCode to filter by contractor name or code.
    
                 


"""
   

# Keep the old function for backward compatibility if needed
def get_routesheet_prompt(user_query: str, current_year: int):
    """Legacy function - redirects to SQL-only prompt"""
    return get_contractorroutesheet_sql_prompt(user_query, current_year)