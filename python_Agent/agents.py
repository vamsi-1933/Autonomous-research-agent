import os
import json
from langchain_mistralai import ChatMistralAI
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
from state import AgentState

load_dotenv()

llm = ChatMistralAI(model="mistral-tiny", temperature=0.2)
search_tool = TavilySearchResults(max_results=5)

# Initialize Vector Store
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vector_store = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)

# ... existing imports ...

def decomposer_agent(state):
    """Breaks complex queries into parallelizable sub-tasks."""
    query = state.get('query', '') if isinstance(state, dict) else str(state)
    
    prompt = f"Break this research query into exactly 3 distinct search tasks. Return ONLY a JSON list of strings. Query: '{query}'"
    
    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        
        # Clean markdown
        if "```json" in content: content = content.split("```json")[1].split("```")[0]
        elif "```" in content: content = content.split("```")[1].split("```")[0]
            
        sub_queries = json.loads(content.strip())
        if not isinstance(sub_queries, list): sub_queries = [str(sub_queries)]
            
    except Exception as e:
        print(f"Decomposer error: {e}")
        sub_queries = [query]

    return {"sub_queries": sub_queries, "current_step": "Decomposing Query"}

def search_agent(state):
    """Performs hybrid search: Web + Vector DB."""
    query = state.get('query', '') if isinstance(state, dict) else str(state)
    sub_queries = state.get('sub_queries', []) if isinstance(state, dict) else []
    
    search_query = sub_queries[0] if isinstance(sub_queries, list) and len(sub_queries) > 0 else query
    
    internal_content = []
    try:
        docs = vector_store.similarity_search(search_query, k=3)
        internal_content = [doc.page_content for doc in docs]
    except Exception as e: print(f"Vector DB error: {e}")

    web_content = []
    try:
        results = search_tool.invoke({"query": search_query})
        web_content = [r['content'] for r in results]
    except Exception as e: print(f"Web search error: {e}")
    
    return {"documents": internal_content + web_content, "current_step": "Searching & Retrieving Data"}

def evaluator_agent(state):
    """Checks relevance."""
    docs = state.get('documents', []) if isinstance(state, dict) else []
    query = state.get('query', '') if isinstance(state, dict) else str(state)
    
    doc_text = "\n".join(docs[:3]) # Limit context to avoid token limits
    prompt = f"Evaluate if these documents answer '{query}'. Return 'PASS' if good, 'FAIL' if bad. Docs: {doc_text[:500]}"
    
    feedback = llm.invoke(prompt).content
    return {"evaluation_feedback": feedback, "current_step": "Evaluating Sources"}

def synthesizer_agent(state):
    # MUST use .get() to avoid 'str' object has no attribute 'get'
    docs = state.get('documents', []) if isinstance(state, dict) else []
    query = state.get('query', '') if isinstance(state, dict) else str(state)
    
    if not docs:
        return {"final_synthesis": "No documents found.", "current_step": "Synthesis Failed"}

    doc_text = "\n".join(docs)
    prompt = f"Synthesize a report on '{query}' using:\n{doc_text}"
    
    try:
        report = llm.invoke(prompt).content
    except Exception as e:
        report = f"Synthesis Error: {str(e)}"
        
    return {"final_synthesis": report, "current_step": "Synthesizing Report"}

def report_qa_agent(state):
    """Answers follow-up questions."""
    synthesis = state.get('final_synthesis', '') if isinstance(state, dict) else ''
    query = state.get('query', '') if isinstance(state, dict) else str(state)
    history = state.get('chat_history', []) if isinstance(state, dict) else []
    
    prompt = f"Answer based STRICTLY on this report:\n\nREPORT: {synthesis}\n\nQUESTION: {query}"
    response = llm.invoke(prompt)
    
    new_history = history + [{"role": "user", "content": query}, {"role": "assistant", "content": response.content}]
    return {"chat_history": new_history, "current_step": "Answering Follow-up"}