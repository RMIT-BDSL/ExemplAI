from ai.llm.openai import llm
from langgraph.graph import StateGraph, MessagesState, START, END

# def mock_llm(state: MessagesState):
#     return {"messages": [{"role": "ai", "content": "hello world"}]}

def chat(state: MessagesState):
    # get the generation data from openai
    response = llm.invoke(state["messages"])
    return {"messages": [{"role": "ai", "content": response.content}]}

graph = StateGraph(MessagesState)
graph.add_node(chat)
graph.add_edge(START, "chat")
graph.add_edge("chat", END)
graph = graph.compile()
