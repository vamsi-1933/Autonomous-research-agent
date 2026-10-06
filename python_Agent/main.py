import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from graph import research_graph 
import asyncio

app = FastAPI(title="Autonomous Research Agent")

class ResearchQuery(BaseModel):
    query: str
    is_follow_up: bool = False
    session_id: str = "default_session"

async def event_generator(query: str, is_follow_up: bool):
    initial_state = {
        "query": query,
        "sub_queries": [],
        "documents": [],
        "evaluation_feedback": "",
        "final_synthesis": "",
        "chat_history": [],
        "is_follow_up": is_follow_up,
        "current_step": "Initializing..."
    }
    
    try:
        async for chunk in research_graph.astream(initial_state):
            for node_name, state_update in chunk.items():
                if isinstance(state_update, dict):
                    step = state_update.get("current_step", f"Completed {node_name}")
                    yield f"data: {json.dumps({'step': step, 'node': node_name})}\n\n"
                    
                    if "final_synthesis" in state_update and state_update["final_synthesis"]:
                        yield f"data: {json.dumps({'final_answer': state_update['final_synthesis']})}\n\n"
                        
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@app.post("/research/stream")
def stream_research(request: ResearchQuery):
    return StreamingResponse(
        event_generator(request.query, request.is_follow_up),
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)