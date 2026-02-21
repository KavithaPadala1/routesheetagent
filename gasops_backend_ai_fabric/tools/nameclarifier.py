from config.azure_client import get_azure_chat_openai
from tools.sql_executor import execute_sql_query
import json
import re


async def name_clarifier_llm(query: str, auth_token=None):
    """
    Identifies categories of ALL ambiguous names in the user query using a 3-step process:
    1. LLM extracts ALL names from user query (without classifying as person/company)
    2. Static SQL query searches for matches in ALL categories (person AND company)
    3. LLM rewrites query with all clarified names OR generates clarification message
    
    Args:
        query: User's original query containing ambiguous names
        auth_token: Authentication token (optional)
    
    Returns:
        dict: Contains either rewritten query OR clarification request
    """
    
    azure_client, azureopenai = get_azure_chat_openai()
    
    print(f"[Name Clarifier] Received query: {query}")
    
    # ============================================================
    # STEP 1: LLM extracts ALL names from user query (NO CLASSIFICATION)
    # ============================================================
    extraction_prompt = f"""
    Extract ALL names (people, companies, contractors, etc.) from this query.
    Return them in a JSON array called "names".
    DO NOT try to classify them as person vs company - just extract all potential names.
    
    IMPORTANT: Do NOT extract:
    - Field names or column references (CWI, NDE, CRI, TR, etc. when used as field references)
    - Technical terms or inspection types
    - Query metadata or conditions
    
    Only extract actual person names and company/contractor names.
    
    User Query: {query}
    
    Examples:
    - "show me projects handled by Joseph at Shaw Pipeline" 
      → {{"names": ["Joseph", "Shaw Pipeline"]}}
    
    - "how many welds did james clark complete for Sky Testing"
      → {{"names": ["james clark", "Sky Testing"]}}
    
    - "Show me details of TechCorr where Aby has worked"
      → {{"names": ["TechCorr", "Aby"]}}
    
    - "give me work orders for supervisor manju"
      → {{"names": ["manju"]}}
    
    - "show me inspections by CWI Smith at Turner Corp"
      → {{"names": ["Smith", "Turner Corp"]}}
    
    - "Show me details for calahan where gregory regalia has worked and there is a difference between the CWI result and NDE result"
      → {{"names": ["calahan", "gregory regalia"]}}
      (Note: CWI and NDE are field references, not names)
    
    Return ONLY the JSON object, no explanation.
    """
    
    try:
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You extract person and company names from queries. Ignore field names, technical terms, and column references. Return only JSON format."},
                {"role": "user", "content": extraction_prompt}
            ],
            temperature=0,
            max_tokens=150
        )
        
        extracted_json = response.choices[0].message.content.strip()
        extracted_data = json.loads(extracted_json)
        all_names = extracted_data.get("names", [])
        
        print(f"[Name Clarifier] Extracted names: {all_names}")
        
        if not all_names:
            return {
                "success": False,
                "error": "Sorry, I couldn't identify any names in your question. 🤔\n\n"
                       "Could you please rephrase with clear names?"
            }
    
    except Exception as e:
        print(f"[Name Clarifier] Error extracting names: {str(e)}")
        return {
            "success": False,
            "error": "Oops! I had trouble understanding that question. 😅 Could you rephrase it?"
        }
    
    # ============================================================
    # STEP 2: Search for ALL extracted names in ALL categories
    # ============================================================
    all_clarifications = []
    
    # Search each name in BOTH person AND company categories
    for name in all_names:
        result = await search_name_in_all_categories(name)
        
        if result and len(result) > 0:
            all_clarifications.append({
                "original_name": name,
                "matches": result
            })
        else:
            # Name not found
            all_clarifications.append({
                "original_name": name,
                "matches": [],
                "not_found": True
            })
    
    # Check if any names were not found
    not_found_names = [item["original_name"] for item in all_clarifications if item.get("not_found")]
    if not_found_names:
        names_str = ", ".join(f"'{name}'" for name in not_found_names)
        return {
            "success": False,
            "error": f"Sorry, I couldn't find {names_str} in our system. 😔\n\n"
                   f"Please check:\n"
                   f"  ✓ Spelling of the name(s)\n"
                   f"  ✓ Try using full names\n"
                   f"  ✓ Verify they exist in our system"
        }
    
    # ============================================================
    # STEP 3: Handle results
    # ============================================================
    # Check if ANY name has multiple matches OR multiple categories
    needs_user_clarification = any(
        len(item["matches"]) > 1 or 
        (len(item["matches"]) == 1 and len(item["matches"][0].get("all_categories", [])) > 1)
        for item in all_clarifications
    )
    
    if needs_user_clarification:
        return await handle_multiple_names_clarification(query, all_clarifications)
    else:
        # All names have single matches in single categories - rewrite query
        return await handle_all_single_matches(query, all_clarifications)


async def search_name_in_all_categories(name: str):
    """
    Search for a name in ALL categories (both person and company).
    Let the database tell us what type it is based on what matches.
    
    Args:
        name: Name to search for
    
    Returns:
        list: List of matches with category, name, type, and similarity score
    """
    
    # ALL categories to search - both person and company
    all_categories = [
        # Company/contractor categories from welddetails
        "WeldingContractorName",
        "ContractorCWIName", 
        "NDEContractorName",
        "CRIContractorName",
        "TRContractorName",
        # Person categories from project_workorderdetails
        "ProjectManagerName",
        "ProjectSupervisor1Name",
        "ProjectSupervisor2Name",
        "ProjectSupervisor3Name",
        "ProjectSupervisor4Name",
        "ProjectEngineer1Name",
        "ProjectEngineer2Name",
        "ProjectEngineer3Name",
        "ProjectEngineer4Name",
        # Person categories from welddetails
        "Welder1Name",
        "Welder2Name",
        "Welder3Name",
        "Welder4Name",
        "CWIName",
        "NDEInspectorName",
        "CRIInspectorName",
        "TRName"
    ]
    
    sql_query = generate_name_search_query(name, all_categories)
    
    try:
        results = execute_sql_query(sql_query)
        
        if not results or len(results) == 0:
            return None
        
        # Process and deduplicate results
        # Group by actual name, then collect all categories/roles
        name_groups = {}
        
        # Determine type based on category
        company_categories = {
            "WeldingContractorName", "ContractorCWIName", "NDEContractorName",
            "CRIContractorName", "TRContractorName"
        }
        
        for row in results:
            count = row.get("count", 0)
            category = row.get("category")
            matched_value = row.get("matched_value")
            similarity = float(row.get("similarity", 0))
            
            if count > 0 and similarity > 0 and matched_value:
                # Determine type from category
                entity_type = "company" if category in company_categories else "person"
                
                # Group by name (not name+category)
                if matched_value not in name_groups:
                    name_groups[matched_value] = {
                        "name": matched_value,
                        "type": entity_type,
                        "categories": [],
                        "max_similarity": similarity
                    }
                
                # Add category to this name's list
                name_groups[matched_value]["categories"].append({
                    "category": category,
                    "similarity": similarity
                })
                
                # Track highest similarity
                if similarity > name_groups[matched_value]["max_similarity"]:
                    name_groups[matched_value]["max_similarity"] = similarity
        
        if not name_groups:
            return None
        
        # Convert to list format with single "best" category per name
        all_matches = []
        for name_value, group_data in name_groups.items():
            # Sort categories by similarity and pick the best one
            best_category = max(group_data["categories"], key=lambda x: x["similarity"])
            
            # Get unique role names (deduplicate Welder1Name, Welder2Name, etc.)
            unique_roles = list(set([format_category_name(c["category"]) for c in group_data["categories"]]))
            
            all_matches.append({
                "name": name_value,
                "category": best_category["category"],
                "type": group_data["type"],
                "similarity": group_data["max_similarity"],
                "all_categories": [c["category"] for c in group_data["categories"]],
                "unique_roles": unique_roles
            })
        
        # Sort by similarity
        all_matches.sort(key=lambda x: x["similarity"], reverse=True)
        return all_matches
        
    except Exception as e:
        print(f"[Name Clarifier] Error searching for '{name}': {str(e)}")
        return None


def generate_name_search_query(name: str, categories: list) -> str:
    """
    Generate SQL query for specific name and categories.
    Searches across welddetails and project_workorderdetails tables.
    Uses fuzzy matching (SOUNDEX, LIKE) to handle typos and partial names.
    
    Args:
        name: The name to search for
        categories: List of category columns to search in
    
    Returns:
        str: Complete SQL query
    """
    sanitized_name = name.replace("'", "''").strip()
    
    union_parts = []
    
    for category in categories:
        # Determine which table based on category
        if category in ['WeldingContractorName', 'Welder1Name', 'Welder2Name', 'Welder3Name', 'Welder4Name',
                       'ContractorCWIName', 'CWIName', 'NDEContractorName', 'NDEInspectorName', 
                       'CRIContractorName', 'CRIInspectorName', 'TRContractorName', 'TRName']:
            table_name = 'welddetails'
            id_column = 'TransmissionWorkOrderID'
        else:
            table_name = 'project_workorderdetails'
            id_column = 'TransmissionWorkOrderID'
        
        query_part = f"""
        SELECT 
            COUNT(DISTINCT {id_column}) as count, 
            '{category}' as category, 
            {category} as matched_value,
            CASE 
                WHEN LOWER({category}) LIKE LOWER('{sanitized_name}%') THEN 1.0
                WHEN LOWER({category}) LIKE LOWER('%{sanitized_name}%') THEN 0.9
                WHEN SOUNDEX({category}) = SOUNDEX('{sanitized_name}') THEN 0.8
                WHEN EXISTS (
                    SELECT 1 FROM STRING_SPLIT(REPLACE({category}, '  ', ' '), ' ') AS word
                    WHERE SOUNDEX(word.value) = SOUNDEX('{sanitized_name}')
                ) THEN 0.7
                ELSE 0.0
            END as similarity
        FROM {table_name}
        WHERE {category} IS NOT NULL
          AND LTRIM(RTRIM({category})) != ''
          AND (
              LOWER({category}) LIKE LOWER('%{sanitized_name}%')
              OR SOUNDEX({category}) = SOUNDEX('{sanitized_name}')
              OR EXISTS (
                  SELECT 1 FROM STRING_SPLIT(REPLACE({category}, '  ', ' '), ' ') AS word
                  WHERE LOWER(word.value) = LOWER('{sanitized_name}')
                     OR SOUNDEX(word.value) = SOUNDEX('{sanitized_name}')
              )
          )
        GROUP BY {category}
        HAVING COUNT(DISTINCT {id_column}) > 0
        """
        union_parts.append(query_part.strip())
    
    full_query = "\nUNION ALL\n".join(union_parts)
    full_query += "\nORDER BY similarity DESC, count DESC"
    return full_query


async def handle_all_single_matches(original_query: str, clarifications: list):
    """
    All names have single matches - rewrite query with all clarified names.
    
    Args:
        original_query: User's original question
        clarifications: List of clarification results (each with single match)
    
    Returns:
        dict: Success response with rewritten query
    """
    
    azure_client, azureopenai = get_azure_chat_openai()
    
    # Build replacement instructions
    replacements = []
    for item in clarifications:
        match = item["matches"][0]
        replacements.append({
            "original": item["original_name"],
            "clarified": f"{match['category']} {match['name']}",
            "type": match["type"],
            "category": match["category"],
            "full_name": match["name"]
        })
    
    replacements_text = "\n".join([
        f"- Replace '{r['original']}' with '{r['clarified']}' ({r['type']})"
        for r in replacements
    ])
    
    rewrite_prompt = f"""
    Rewrite this query by replacing ALL ambiguous names with their clarified versions.
    
    Original Query: {original_query}
    
    Replacements to make:
    {replacements_text}
    
    Examples:
    - Original: "show me projects by Joseph at Shaw Pipeline"
      Replacements: Joseph → ProjectSupervisor1Name Joseph Clark (person), Shaw Pipeline → WeldingContractorName Shaw Pipeline Services (company)
      Rewritten: "show me projects by ProjectSupervisor1Name Joseph Clark at WeldingContractorName Shaw Pipeline Services"
    
    Return ONLY the rewritten query, nothing else.
    """
    
    try:
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You rewrite queries by replacing ambiguous names with clarified names and categories. Return only the rewritten query."},
                {"role": "user", "content": rewrite_prompt}
            ],
            temperature=0,
            max_tokens=200
        )
        
        rewritten_query = response.choices[0].message.content.strip()
        print(f"[Name Clarifier] Rewritten query: {rewritten_query}")
        
        return {
            "success": True,
            "original_query": original_query,
            "rewritten_query": rewritten_query,
            "clarifications": replacements
        }
        
    except Exception as e:
        print(f"[Name Clarifier] Error rewriting query: {str(e)}")
        # Fallback to simple replacement
        rewritten = original_query
        for r in replacements:
            rewritten = rewritten.replace(r["original"], r["clarified"])
        
        return {
            "success": True,
            "original_query": original_query,
            "rewritten_query": rewritten,
            "clarifications": replacements
        }


async def handle_multiple_names_clarification(original_query: str, clarifications: list):
    """
    At least one name has multiple matches - ask user for clarification.
    Only shows names with multiple matches (skips confirmed single matches).
    Uses LLM to filter out irrelevant matches before showing to user.
    
    Args:
        original_query: User's original question
        clarifications: List of clarification results (some with multiple matches)
    
    Returns:
        dict: Clarification request with only relevant matches listed
    """
    
    azure_client, azureopenai = get_azure_chat_openai()
    
    # First, ask LLM to filter irrelevant matches
    filtering_prompt = f"""
    User query: {original_query}
    
    We found multiple matches for names in the query. Filter out ONLY the truly irrelevant matches.
    
    Guidelines:
    - Remove matches where the name is phonetically similar but actually different (e.g., "Bryan" is NOT "Brian")
    - If user searched for "Sky Testing", keep only "Sky Testing" matches
    - Remove matches that are phonetically similar but semantically different (e.g., "Shaw Pipeline Services" is NOT relevant for "Sky Testing")
    - Keep variations of the same name (e.g., "Wayne Griffiths" and "Wayne Griffiths Jr" are both relevant)
    - For company names: be strict - only keep exact or very close matches
    - For person names: keep only if the names are actually the same person (e.g., "Brian" vs "Bryan" are different people)
    - Be strict with phonetic matches - SOUNDEX can match different names, so verify they're actually the same
    
    Here are the matches found:
    {json.dumps(clarifications, indent=2)}
    
    Return a JSON object with the same structure, but with irrelevant matches removed from the "matches" arrays.
    Only modify the "matches" arrays - keep everything else the same.
    
    Return ONLY the filtered JSON array (not wrapped in any object), no explanation.
    The response must be a JSON array of objects like: [{{"original_name": "...", "matches": [...]}}, ...]
    """
    
    try:
        filter_response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You filter irrelevant name matches. Be strict about phonetic matches - only keep if names are actually the same. Return only the filtered JSON array with the same structure as the input."},
                {"role": "user", "content": filtering_prompt}
            ],
            temperature=0,
            max_tokens=1000
        )
        
        filtered_json = filter_response.choices[0].message.content.strip()
        # Remove markdown code blocks if present
        filtered_json = filtered_json.replace("```json", "").replace("```", "").strip()
        
        # Parse and validate the JSON
        filtered_clarifications = json.loads(filtered_json)
        
        # Ensure it's a list
        if not isinstance(filtered_clarifications, list):
            print(f"[Name Clarifier] Filtering returned non-list: {type(filtered_clarifications)}, using original matches")
            filtered_clarifications = clarifications
        else:
            # Validate structure
            valid_structure = True
            for item in filtered_clarifications:
                if not isinstance(item, dict) or "matches" not in item or "original_name" not in item:
                    print(f"[Name Clarifier] Invalid filtered structure in item: {item}, using original matches")
                    filtered_clarifications = clarifications
                    valid_structure = False
                    break
            
            if valid_structure:
                print(f"[Name Clarifier] Successfully filtered irrelevant matches using LLM")
        
    except Exception as e:
        print(f"[Name Clarifier] Error filtering matches: {str(e)}, using original matches")
        filtered_clarifications = clarifications
    
    # If after filtering, no ambiguity remains, try to rewrite
    # Check both: multiple different names OR single name with multiple roles
    if all(
        isinstance(item, dict) and
        len(item.get("matches", [])) == 1 and 
        len(item.get("matches", [{}])[0].get("unique_roles", [])) <= 1
        for item in filtered_clarifications
    ):
        print("[Name Clarifier] After filtering, all names have single matches in single roles - rewriting query")
        return await handle_all_single_matches(original_query, filtered_clarifications)
    
    # Format names: single matches as confirmation, multiple matches for selection
    single_match_confirmations = []
    multiple_match_items = []
    
    for item in filtered_clarifications:
        # Safety check
        if not isinstance(item, dict):
            print(f"[Name Clarifier] Skipping non-dict item: {item}")
            continue
        
        name = item.get("original_name", "")
        matches = item.get("matches", [])
        
        if len(matches) == 1:
            # Single match - show as confirmation question
            match = matches[0]
            # Use unique_roles to avoid duplication
            unique_roles = match.get("unique_roles", [])
            if len(unique_roles) > 1:
                roles = "  or  ".join(unique_roles)
                single_match_confirmations.append(
                    f"For **{name}**, you mean **{match['name']}** — {roles}, right?"
                )
            elif len(unique_roles) == 1:
                single_match_confirmations.append(
                    f"For **{name}**, you mean **{match['name']}** — {unique_roles[0]}, right?"
                )
            else:
                # Fallback if no unique_roles
                single_match_confirmations.append(
                    f"For **{name}**, you mean **{format_category_name(match['category'])} {match['name']}**, right?"
                )
        
        elif len(matches) > 1:
            # Multiple matches - show to user for selection
            match_list = []
            for i, m in enumerate(matches[:5]):  # Top 5 matches
                # Use unique_roles to avoid duplication
                unique_roles = m.get("unique_roles", [])
                if len(unique_roles) > 1:
                    roles = "  or  ".join(unique_roles)
                    match_list.append(f"  {i+1}. **{m['name']}** — {roles}")
                elif len(unique_roles) == 1:
                    match_list.append(f"  {i+1}. **{m['name']}** — {unique_roles[0]}")
                else:
                    # Fallback if no unique_roles
                    match_list.append(f"  {i+1}. **{m['name']}** — {format_category_name(m['category'])}")
            
            multiple_match_items.append(
                f"**{name}**:\n" + "\n".join(match_list)
            )
    
    # Build clarification text
    clarification_parts = []
    
    if single_match_confirmations:
        clarification_parts.append("\n".join(single_match_confirmations))
    
    if multiple_match_items:
        if single_match_confirmations:
            clarification_parts.append("\nFor the following, please select:")
        clarification_parts.append("\n\n".join(multiple_match_items))
    
    clarification_text = "\n\n".join(clarification_parts)
    
    clarification_prompt = f"""
    The user's query contains names that need confirmation or selection.
    
    Message to show:
    {clarification_text}
    
    Generate a friendly, concise message:
    - If there are single match confirmations, acknowledge them warmly
    - If there are multiple matches, ask the user to select
    - Be warm and helpful with 1-2 emojis
    - Keep it brief and conversational
    - Include the formatted content above in your response
    
    Return ONLY the clarification message text.
    """
    
    try:
        response = azure_client.chat.completions.create(
            model=azureopenai,
            messages=[
                {"role": "system", "content": "You create friendly clarification messages that confirm single matches and ask for selection on multiple matches."},
                {"role": "user", "content": clarification_prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        
        clarification_message = response.choices[0].message.content.strip()
        print(f"[Name Clarifier] Generated clarification message: {clarification_message}")
        
        return {
            "success": False,
            "needs_clarification": True,
            "clarification_message": clarification_message,
            "matches": filtered_clarifications,
            "original_query": original_query
        }
        
    except Exception as e:
        print(f"[Name Clarifier] Error generating clarification: {str(e)}")
        # Fallback
        return {
            "success": False,
            "needs_clarification": True,
            "clarification_message": f"I found multiple matches! 😊 Please select:\n\n{clarification_text}",
            "matches": filtered_clarifications,
            "original_query": original_query
        }


def format_category_name(category: str) -> str:
    """
    Format category name for display.
    Handles numbered categories (Welder1Name, ProjectSupervisor2Name, etc.)
    Keeps acronyms together (CWI, NDE, CRI, TR).
    
    Examples:
        ProjectManagerName -> Project Manager
        Welder1Name -> Welder
        ProjectSupervisor2Name -> Project Supervisor
        NDEInspectorName -> NDE Inspector
        CWIName -> CWI
        CRIInspectorName -> CRI Inspector
    """
    # Remove "Name" suffix
    display = category.replace("Name", "")
    
    # Remove numbers (1, 2, 3, 4)
    display = re.sub(r'[1-4]$', '', display)
    
    # Add spaces before capital letters, but keep consecutive capitals together (acronyms)
    # This regex adds space before a capital letter that's followed by a lowercase letter
    display = re.sub(r'([A-Z])(?=[a-z])', r' \1', display).strip()
    
    return display