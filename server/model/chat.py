from pydantic import BaseModel


# TODO: scope this model more properly
class Chat(BaseModel):
    # understand who is it
    user_id: int

    # normal chat - send full chat
    conversation: list[dict]
