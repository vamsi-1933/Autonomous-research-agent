from typing import TypedDict, List, Annotated
import operator

class AgentState(TypedDict):
    query: str
    sub_queries: List[str]
    documents: Annotated[List[str], operator.add]
    evaluation_feedback: str
    final_synthesis: str     
    chat_history: List[dict] 
    current_step: str