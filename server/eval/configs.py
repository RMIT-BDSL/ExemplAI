"""OpenRouter setups to compare: settings overrides (config.py, OPENROUTER_*).

"agent" = the example / control agents; "check" = the input guardrail and Dean.
"""

V41 = "deepseek/deepseek-v4.1-flash"

_FAST = dict(OPENROUTER_PROVIDER_SORT="throughput", OPENROUTER_REQUIRE_PARAMETERS=True,
             OPENROUTER_AGENT_MAX_TOKENS=16384, OPENROUTER_CHECK_MAX_TOKENS=8192, OPENROUTER_CHECK_MODEL="")

CONFIGS: dict[str, dict] = {
    # What production ran before: V4 Flash 0731 with OpenRouter's defaults.
    "A_v4-0731_default": dict(OPENROUTER_MODEL="deepseek/deepseek-v4-flash-0731", OPENROUTER_PROVIDER_SORT="",
                              OPENROUTER_REQUIRE_PARAMETERS=False, OPENROUTER_AGENT_REASONING="",
                              OPENROUTER_CHECK_REASONING="", OPENROUTER_AGENT_MAX_TOKENS=0,
                              OPENROUTER_CHECK_MAX_TOKENS=0, OPENROUTER_CHECK_MODEL=""),
    "B_v41_low-low": dict(_FAST, OPENROUTER_MODEL=V41, OPENROUTER_AGENT_REASONING="low", OPENROUTER_CHECK_REASONING="low"),
    "C_v41_low-none": dict(_FAST, OPENROUTER_MODEL=V41, OPENROUTER_AGENT_REASONING="low", OPENROUTER_CHECK_REASONING="none"),
    "D_v41_none-none": dict(_FAST, OPENROUTER_MODEL=V41, OPENROUTER_AGENT_REASONING="none", OPENROUTER_CHECK_REASONING="none"),
    "E_v41_medium-low": dict(_FAST, OPENROUTER_MODEL=V41, OPENROUTER_AGENT_REASONING="medium", OPENROUTER_CHECK_REASONING="low"),
    # Split roles: DeepSeek writes, gpt-oss-120b (fast providers) checks.
    "F_v41+gptoss-check": dict(_FAST, OPENROUTER_MODEL=V41, OPENROUTER_CHECK_MODEL="openai/gpt-oss-120b",
                               OPENROUTER_AGENT_REASONING="low", OPENROUTER_CHECK_REASONING="low"),
    "G_gemini-3.8-flash_low": dict(_FAST, OPENROUTER_MODEL="google/gemini-3.8-flash",
                                   OPENROUTER_AGENT_REASONING="low", OPENROUTER_CHECK_REASONING="low"),
    # Anthropic's extended thinking needs a >= 1024-token budget, so Haiku runs without it.
    "H_haiku-4.5_none": dict(_FAST, OPENROUTER_MODEL="anthropic/claude-haiku-4.5",
                             OPENROUTER_AGENT_REASONING="none", OPENROUTER_CHECK_REASONING="none"),
}
