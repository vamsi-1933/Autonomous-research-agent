from langgraph.graph import StateGraph, END
from state import AgentState
from agents import ResearchAgent
from agents import decomposer_agent, search_agent, evaluator_agent, synthesizer_agent, report_qa_agent

def build_research_graph():
    workflow = StateGraph(AgentState)

    # Add all nodes
    workflow.add_node("decomposer", decomposer_agent)
    workflow.add_node("searcher", search_agent)
    workflow.add_node("evaluator", evaluator_agent)
    workflow.add_node("synthesizer", synthesizer_agent)
    workflow.add_node("qa_agent", report_qa_agent)

    # Define the Research Flow
    workflow.set_entry_point("decomposer")
    workflow.add_edge("decomposer", "searcher")
    workflow.add_edge("searcher", "evaluator")
    workflow.add_edge("evaluator", "synthesizer")

    # Define the Routing Logic
    def route_after_synthesis(state):
        """If a user asks a follow-up, go to QA. Otherwise, end."""
        return "qa_agent" if state.get('is_follow_up') else END

    # Add a conditional edge from synthesizer to allow for follow-ups
    workflow.add_conditional_edges(
        "synthesizer",
        lambda state: "qa_agent" if state.get('is_follow_up') else END,
        {"qa_agent": "qa_agent", END: END}
    )

    # Define the Q&A Loop

    workflow.add_edge("qa_agent", END)

    return workflow.compile()

research_graph = build_research_graph()