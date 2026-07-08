"""Robo Chef integration with the OpenAI API.

If OPENAI_API_KEY is not configured, ask_robo_chef() returns a clearly
labeled mock answer so the rest of the app keeps working in local/dev mode.
"""

import json

from openai import OpenAI

from .. import config

_client = OpenAI(api_key=config.OPENAI_API_KEY) if config.USE_OPENAI else None

SYSTEM_PROMPT = (
    "You are Robo Chef, a friendly and concise AI cooking assistant for the "
    "Cook With Me app. Give practical, short answers about recipes, "
    "ingredient substitutions, and cooking techniques."
)

_STRUCTURED_SYSTEM_SUFFIX = (
    "\n\nRespond with a JSON object containing \"answer\" (your normal reply "
    "text) and \"memoryUpdates\" (stable, durable facts about the user worth "
    "remembering long-term - allergies, dietary restrictions, disliked "
    "ingredients, preferred cuisines, cooking skill, equipment, cooking "
    "goals). Leave arrays empty and cookingSkill null unless the user "
    "explicitly stated something new and durable in this message - never "
    "guess, and never record one-off ingredients, temporary questions, or "
    "casual remarks."
)

_MEMORY_UPDATES_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "allergies",
        "dietaryRestrictions",
        "dislikedIngredients",
        "preferredCuisines",
        "cookingSkill",
        "equipment",
        "cookingGoals",
    ],
    "properties": {
        "allergies": {"type": "array", "items": {"type": "string"}},
        "dietaryRestrictions": {"type": "array", "items": {"type": "string"}},
        "dislikedIngredients": {"type": "array", "items": {"type": "string"}},
        "preferredCuisines": {"type": "array", "items": {"type": "string"}},
        "cookingSkill": {
            "type": ["string", "null"],
            "enum": ["beginner", "intermediate", "advanced", None],
        },
        "equipment": {"type": "array", "items": {"type": "string"}},
        "cookingGoals": {"type": "array", "items": {"type": "string"}},
    },
}

_STRUCTURED_REPLY_JSON_SCHEMA = {
    "name": "robo_chef_reply",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["answer", "memoryUpdates"],
        "properties": {
            "answer": {"type": "string"},
            "memoryUpdates": _MEMORY_UPDATES_SCHEMA,
        },
    },
}

# Shown to the user whenever a structured reply can't be safely turned into
# a real answer (refusal, empty answer, or unparseable/truncated JSON) -
# never the raw model output in those cases.
_FALLBACK_ANSWER = "Robo Chef couldn't come up with an answer for that - try rephrasing?"


def _empty_memory_updates():
    return {}


def _build_messages(message, context, structured=False):
    """Builds the chat.completions messages array.

    `context` is optional and additive: with no context (the /api/ai/ask
    compatibility path) this produces exactly the [system, user] pair the
    endpoint always sent. `systemContext` appends persona/profile/recipe
    context to the system prompt; `history` (a list of {role, content},
    already trimmed/bounded by the caller) supplies prior turns from the
    selected conversation only. `structured` appends the memory-extraction
    instruction used only by the structured-output path.
    """
    system_content = SYSTEM_PROMPT
    extra = (context or {}).get("systemContext")
    if extra:
        system_content = f"{SYSTEM_PROMPT}\n\n{extra}"
    if structured:
        system_content += _STRUCTURED_SYSTEM_SUFFIX

    messages = [{"role": "system", "content": system_content}]

    for entry in (context or {}).get("history") or []:
        role = entry.get("role")
        content = entry.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})
    return messages


def ask_robo_chef(message, context=None):
    """Unchanged contract: always returns a plain string answer, built from
    exactly [system, user] - identical to this function's original
    behavior. Used by the /api/ai/ask compatibility endpoint, which has no
    auth requirement, so `context` is accepted for call-site compatibility
    only and is always ignored here: honoring client-supplied
    systemContext/history on an unauthenticated endpoint would be a
    prompt-injection surface. Only ask_robo_chef_structured(), invoked with
    server-built context from authenticated conversation routes, may
    actually consume context."""
    if _client is None:
        return (
            "[Mock Robo Chef] OPENAI_API_KEY is not configured, so this is a "
            f"placeholder response. You asked: \"{message}\". Once an OpenAI "
            "API key is provided, Robo Chef will answer using a real AI model."
        )

    response = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=_build_messages(message, None),
    )
    return response.choices[0].message.content


def ask_robo_chef_structured(message, context=None):
    """Returns (answer_text, memory_updates) for persistent conversations.

    `memory_updates` is a plain dict shaped by the request's strict JSON
    schema, but callers must still treat it as untrusted model output: this
    function does not allowlist/size-validate/merge it, and callers must
    never return it directly to the frontend. That validation and merging
    happens where it's actually persisted (not yet wired in this phase).

    Never raises for parsing/content issues - a refusal, empty answer, or
    malformed JSON degrades to a safe fallback answer and empty memory
    updates instead. SDK/network exceptions (rate limits, timeouts,
    connectivity) are not caught here and propagate to the caller, exactly
    like ask_robo_chef() does today.
    """
    if _client is None:
        mock_answer = (
            "[Mock Robo Chef] OPENAI_API_KEY is not configured, so this is a "
            f"placeholder response. You asked: \"{message}\". Once an OpenAI "
            "API key is provided, Robo Chef will answer using a real AI model."
        )
        return mock_answer, _empty_memory_updates()

    response = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=_build_messages(message, context, structured=True),
        response_format={"type": "json_schema", "json_schema": _STRUCTURED_REPLY_JSON_SCHEMA},
    )
    return _parse_structured_reply(response)


def _parse_structured_reply(response):
    """Pure parsing/validation of an already-received chat completion.
    Always returns (answer_text: str, memory_updates: dict); never raises,
    regardless of how malformed or unexpected the response shape is."""
    choices = getattr(response, "choices", None) or []
    if not choices:
        return _FALLBACK_ANSWER, _empty_memory_updates()

    message = getattr(choices[0], "message", None)
    if message is None:
        return _FALLBACK_ANSWER, _empty_memory_updates()

    if getattr(message, "refusal", None):
        return _FALLBACK_ANSWER, _empty_memory_updates()

    raw_content = getattr(message, "content", None)
    if not isinstance(raw_content, str) or not raw_content.strip():
        # Covers missing content, None, and non-string content (e.g. the
        # SDK returning a list/dict instead of a plain string) - never call
        # .strip()/json.loads() on something that isn't already a string.
        return _FALLBACK_ANSWER, _empty_memory_updates()

    try:
        parsed = json.loads(raw_content)
    except (json.JSONDecodeError, TypeError, ValueError):
        stripped = raw_content.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            # Looks like a broken/truncated JSON object or array - never
            # show a raw JSON fragment to the user, whichever bracket it
            # starts with.
            return _FALLBACK_ANSWER, _empty_memory_updates()
        # The model ignored the schema and replied in plain prose - that
        # text is still safe to show as-is.
        return stripped, _empty_memory_updates()

    if not isinstance(parsed, dict):
        # Valid JSON but not the expected object shape (e.g. a bare array,
        # string, or number) - never surface that as the answer.
        return _FALLBACK_ANSWER, _empty_memory_updates()

    answer = parsed.get("answer")
    if isinstance(answer, str) and answer.strip():
        answer = answer.strip()
    else:
        answer = _FALLBACK_ANSWER

    memory_updates = parsed.get("memoryUpdates")
    if not isinstance(memory_updates, dict):
        memory_updates = _empty_memory_updates()

    return answer, memory_updates
