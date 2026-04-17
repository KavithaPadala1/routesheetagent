
import asyncio
import os
import sys
import logging
from langchain_community.vectorstores.azuresearch import AzureSearch
from langchain_openai import AzureOpenAIEmbeddings
from langchain_core.documents import Document
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import CharacterTextSplitter


import os
from dotenv import load_dotenv


load_dotenv()   





# Azure configuration
azure_embedding_endpoint = os.getenv("AZURE_EMBEDDING_ENDPOINT")
azure_embedding_api_key = os.getenv("AZURE_EMBEDDING_API_KEY")
azure_embedding_api_version = os.getenv("AZURE_EMBEDDING_API_VERSION")

azure_embedding_deployment = os.getenv("AZURE_SEARCH_DEPLOYMENT")   # Embedding deployment name

vector_store_address = os.getenv("AZURE_SEARCH_ENDPOINT")
vector_store_password = os.getenv("AZURE_SEARCH_KEY")



# index_name = "gasopsroutesheetindex"  # Azure Search index name
# index_name = "contractorroutesheetindex"  # Azure Search index name for contractor routesheet
# index_name = "tunnelsroutesheetindex"  # Azure Search index name for tunnels routesheet
# index_name = 'corrosionroutesheetindex'  # Azure Search index name for corrosion routesheet
# index_name = 'leaksurveyroutesheetindex'  # Azure Search index name for leaksurvey routesheet
# index_name = 'sliroutesheetindex'  # Azure Search index name for sli routesheet
# index_name = 'gdssteadyroutesheetindex'  # Azure Search index name for gds steady routesheet
index_name = 'gdsrotatingroutesheetindex'  # Azure Search index name for gds rotating routesheet


# Initialize embeddings
embeddings = AzureOpenAIEmbeddings(
    azure_deployment=azure_embedding_deployment,
    openai_api_version=azure_embedding_api_version,
    azure_endpoint=azure_embedding_endpoint,
    api_key=azure_embedding_api_key,
)

# Function to initialize AzureSearch
def initialize_vector_store(index_name:str):
    logging.info("Initializing vector store...")
    return AzureSearch(
        azure_search_endpoint=vector_store_address,
        azure_search_key=vector_store_password,
        index_name=index_name,
        embedding_function=embeddings.embed_query,
        additional_search_client_options={"retry_total": 4},
    )

# Custom text splitter
class EmptyLineTextSplitter(CharacterTextSplitter):
    def split_text(self, text: str):
        return text.strip().split("\n\n")

# Function to process documents
def process_documents(file_path: str):
    logging.info(f"Loading documents from {file_path}...")
    loader = TextLoader(file_path, encoding="utf-8")
    documents = loader.load()

    logging.info("Splitting documents into chunks...")
    text_splitter = EmptyLineTextSplitter(chunk_size=1000, chunk_overlap=0)
    docs = [
        Document(page_content=chunk)
        for doc in documents
        for chunk in text_splitter.split_text(doc.page_content)
    ]

    logging.info(f"Created {len(docs)} document chunks.")
    return docs

# Function to perform similarity search
def perform_similarity_search(vector_store, query: str, k: int):
    logging.info("Performing similarity search...")
    results = vector_store.similarity_search(query=query, k=k, search_type="similarity")
    logging.info("Similarity search completed.")
    return results

# Main execution
if __name__ == "__main__":
    vector_store = None 
    try:
        ## for gas operations routesheet examples
        # vector_store = initialize_vector_store(index_name="gasopsroutesheetindex")
        # docs = process_documents("gasopsroutesheet_examples.txt")    # path to the examples txt file to index
        # vector_store.add_documents(documents=docs)
        ## for contractor routesheet examples
        # vector_store = initialize_vector_store(index_name="contractorroutesheetindex")
        # docs = process_documents("contractorroutesheet_examples.txt")    # path to the examples txt file to index
        # vector_store.add_documents(documents=docs)
        # for tunnels routesheet examples
        # vector_store = initialize_vector_store(index_name="tunnelsroutesheetindex")
        # docs = process_documents("tunnelsroutesheet_examples.txt")    # path to the examples txt file to index
        # vector_store.add_documents(documents=docs)
        # for corrosion routesheet examples
        # vector_store = initialize_vector_store(index_name="corrosionroutesheetindex")
        # docs = process_documents("corrosionroutesheet_examples.txt")    # path to the examples txt file to index
        # vector_store.add_documents(documents=docs) 
        # for leaksurvey routesheet examples
        # vector_store = initialize_vector_store(index_name="leaksurveyroutesheetindex")
        # docs = process_documents("leaksurveyroutesheet_examples.txt")    # path to the examples txt file to index
        # vector_store.add_documents(documents=docs)  
        # for sli routesheet examples
        # vector_store = initialize_vector_store(index_name="sliroutesheetindex")
        # docs = process_documents("sliroutesheet_examples.txt")    # path to the examples txt file to index
        # vector_store.add_documents(documents=docs) 
        # for gds steady routesheet examples
        # vector_store = initialize_vector_store(index_name="gdssteadyroutesheetindex")
        # docs = process_documents("gdssteadyroutesheet_examples.txt")    # path to the examples txt file to index
        # vector_store.add_documents(documents=docs)
        # for gds rotating routesheet examples
        vector_store = initialize_vector_store(index_name="gdsrotatingroutesheetindex")
        docs = process_documents("gdsrotatingroutesheet_examples.txt")    # path to the examples txt file to index
        vector_store.add_documents(documents=docs)
        
    finally:
        logging.info("Closing vector store.")
        if hasattr(vector_store, 'close'):
            vector_store.close()


