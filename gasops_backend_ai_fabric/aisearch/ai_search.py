import logging
from langchain_community.vectorstores.azuresearch import AzureSearch
from langchain_openai import AzureOpenAIEmbeddings
from langchain_text_splitters import CharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document

import os
import sys


# Configure logging
# logging.basicConfig(level=logging.DEBUG)

from dotenv import load_dotenv
load_dotenv()   

# Azure configuration
azure_embedding_endpoint = os.getenv("AZURE_EMBEDDING_ENDPOINT")
azure_embedding_api_key = os.getenv("AZURE_EMBEDDING_API_KEY")
azure_embedding_api_version = os.getenv("AZURE_EMBEDDING_API_VERSION")

azure_embedding_deployment = os.getenv("AZURE_SEARCH_DEPLOYMENT")   # Embedding deployment name
vector_store_address = os.getenv("AZURE_SEARCH_ENDPOINT")
vector_store_password = os.getenv("AZURE_SEARCH_KEY")

index_name = "tunnelsroutesheetindex"  # Azure Search index name


# Embeddings: use Azure OpenAI endpoint/key/deployment for embeddings
embeddings = AzureOpenAIEmbeddings(
    azure_deployment=azure_embedding_deployment,
    openai_api_version=azure_embedding_api_version,
    azure_endpoint=azure_embedding_endpoint,
    api_key=azure_embedding_api_key,
)

# gas operations routesheet specific AI Search function
def routesheet_search(user_text: str):
    index_name = "gasopsroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results

# contractor routesheet specific AI Search function

def contractor_routesheet_search(user_text: str):
    index_name = "contractorroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results


# tunnels routesheet specific AI Search function

def tunnels_routesheet_search(user_text: str):
    index_name = "tunnelsroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results


# corrosion routesheet specific AI Search function

def corrosion_routesheet_search(user_text: str):
    index_name = "corrosionroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results

# leaksurvey routesheet specific AI Search function

def leaksurvey_routesheet_search(user_text: str):
    index_name = "leaksurveyroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results

# sli routesheet specific AI Search function

def sli_routesheet_search(user_text: str):
    index_name = "sliroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results

# gds steady routesheet specific AI Search function

def gds_steady_routesheet_search(user_text: str):
    index_name = "gdssteadyroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results

# gds rotating routesheet specific AI Search function

def gds_rotating_routesheet_search(user_text: str):
    index_name = "gdsrotatingroutesheetindex"

    vector_store = AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

    results = vector_store.similarity_search(query=user_text, k=3, search_type="similarity")
    return results

# testing ai search results
if __name__ == "__main__":
        user_question = "summarise gas ops routesheet for feb 5th"
        results = routesheet_search(user_question)
        print("AI Search Results for question:", user_question)
        for i, res in enumerate(results, 1):
            print(f"Result {i}:")
            print(res)


