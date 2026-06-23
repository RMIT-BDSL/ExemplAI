"""
Chat with openai as llm
"""

import os
import dotenv
from langchain.chat_models import init_chat_model

dotenv.load_dotenv()


# uses gpt-4o-mini for now
llm = init_chat_model(model="gpt-4o-mini")