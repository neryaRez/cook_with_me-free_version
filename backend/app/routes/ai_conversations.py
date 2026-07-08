"""Persistent Robo Chef conversations, messages, and long-term user memory.

Every query here is scoped by both the resource id and the authenticated
Cognito `sub` (see auth.py) - never by anything the client sends. This
mirrors the ownership pattern already used in routes/recipes.py (e.g.
update_comment/delete_comment checking authorSub).
"""

import json
import logging
from datetime import datetime, timedelta

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from .. import config
from ..auth import require_auth
from ..db import get_session
from ..models import AiConversation, AiMessage, AiUserMemory, Recipe, User
from ..services.openai_service import ask_robo_chef, ask_robo_chef_structured

logger = logging.getLogger(__name__)

ai_conversations_bp = Blueprint("ai_conversations", __name__, url_prefix="/api/ai/conversations")
ai_memory_bp = Blueprint("ai_memory", __name__, url_prefix="/api/ai/memory")

_MAX_MESSAGE_LENGTH = 4000
_MAX_TITLE_LENGTH = 120

# Bounded, server-built AI context. None of these are client-controlled -
# every block below is built strictly from server-side queries scoped to the
# authenticated owner_sub of the current conversation (see auth.py /
# require_auth). No client-supplied "context" is ever accepted or used here.
_MAX_RECENT_MESSAGES = 10
_MAX_HISTORY_MESSAGE_CHARS = 600  # context-only truncation; stored content is never mutated
_MAX_RECIPE_CATALOG = 8
_MAX_RECIPE_DESCRIPTION_CHARS = 90
_MAX_PROFILE_CONTEXT_CHARS = 150
_MAX_MEMORY_CONTEXT_CHARS = 500
_MAX_SUMMARY_CONTEXT_CHARS = 800  # also the max length a stored summary is truncated to on write

_RATE_LIMIT_WINDOW_SECONDS = 60
_RATE_LIMIT_MAX_MESSAGES = 20

# Bounded conversation summarization. Summarizes only messages older than the
# always-verbatim _MAX_RECENT_MESSAGES window, and only once enough of them
# have piled up - not on every turn. See _maybe_summarize_conversation.
_SUMMARY_UNSUMMARIZED_THRESHOLD = 20

_MEMORY_LABELS = {
    "allergies": "Allergies",
    "dietaryRestrictions": "Dietary restrictions",
    "dislikedIngredients": "Dislikes",
    "preferredCuisines": "Preferred cuisines",
    "cookingSkill": "Cooking skill",
    "equipment": "Available equipment",
    "cookingGoals": "Cooking goals",
}
_MEMORY_ALLOWED_KEYS = set(_MEMORY_LABELS)

# Automatic, conservative memory extraction (from ask_robo_chef_structured's
# memoryUpdates - untrusted model output). Every field below is allowlisted,
# shape/size-bounded, and merged additively - see _validate_memory_updates
# and _merge_memory. This never runs on the client-editable PATCH
# /api/ai/memory path (that endpoint's own allowlist is _MEMORY_ALLOWED_KEYS
# above and still permits explicit deletion by the user).
_MEMORY_LIST_MAX_ITEMS = {
    "allergies": 10,
    "dietaryRestrictions": 10,
    "dislikedIngredients": 20,
    "preferredCuisines": 10,
    "equipment": 20,
    "cookingGoals": 10,
}
_MEMORY_ITEM_MAX_CHARS = {
    "allergies": 40,
    "dietaryRestrictions": 40,
    "dislikedIngredients": 40,
    "preferredCuisines": 40,
    "equipment": 40,
    "cookingGoals": 60,
}
_MEMORY_SKILL_VALUES = {"beginner", "intermediate", "advanced"}
_MAX_MEMORY_SERIALIZED_BYTES = 4096


def _normalize_text(text):
    return " ".join((text or "").split())


def _truncate(text, max_length):
    if len(text) <= max_length:
        return text
    truncated = text[:max_length].rsplit(" ", 1)[0].rstrip()
    if not truncated:
        truncated = text[:max_length].rstrip()
    return truncated + "…"


def _serialize_conversation(conversation):
    return {
        "id": conversation.id,
        "title": conversation.title,
        "preview": conversation.preview,
        "createdAt": conversation.created_at.isoformat() if conversation.created_at else None,
        "updatedAt": conversation.updated_at.isoformat() if conversation.updated_at else None,
    }


def _serialize_message(message):
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "createdAt": message.created_at.isoformat() if message.created_at else None,
    }


def _get_owned_conversation(session, conversation_id, owner_sub):
    return (
        session.query(AiConversation)
        .filter(AiConversation.id == conversation_id, AiConversation.owner_sub == owner_sub)
        .first()
    )


def _is_rate_limited(session, owner_sub):
    cutoff = datetime.utcnow() - timedelta(seconds=_RATE_LIMIT_WINDOW_SECONDS)
    count = (
        session.query(AiMessage)
        .join(AiConversation, AiMessage.conversation_id == AiConversation.id)
        .filter(
            AiConversation.owner_sub == owner_sub,
            AiMessage.role == "user",
            AiMessage.created_at >= cutoff,
        )
        .count()
    )
    return count >= _RATE_LIMIT_MAX_MESSAGES


def _build_profile_context(owner_sub):
    """One line naming the authenticated user, or None. Runs in its own
    short-lived DB session (never the route's session): if the query fails,
    that session alone is rolled back and closed, so a poisoned transaction
    here can never propagate into the route session that owns the normal
    message-persistence flow. Degrades safely: a profile lookup failure
    omits this block rather than failing the chat."""
    context_session = get_session()
    try:
        try:
            user = context_session.query(User).filter_by(cognito_sub=owner_sub).first()
        except Exception as exc:
            context_session.rollback()
            logger.warning(
                "Robo Chef context: profile lookup failed (owner_sub=%s, error=%s)",
                owner_sub, type(exc).__name__,
            )
            return None

        display_name = (user.display_name or user.username) if user else None
        if not display_name:
            return None
        return _truncate(f"You are chatting with {display_name}.", _MAX_PROFILE_CONTEXT_CHARS)
    finally:
        context_session.close()


def _build_memory_context(owner_sub):
    """Existing durable memory for the authenticated user, or None. Runs in
    its own short-lived DB session, isolated the same way as
    _build_profile_context. Degrades safely: a memory lookup failure omits
    this block rather than failing the chat. Does not write anything -
    automatic memory persistence is not wired in yet (memory_updates from
    ask_robo_chef_structured is discarded by _generate_reply for now)."""
    context_session = get_session()
    try:
        try:
            memory_row = context_session.query(AiUserMemory).filter_by(owner_sub=owner_sub).first()
        except Exception as exc:
            context_session.rollback()
            logger.warning(
                "Robo Chef context: memory lookup failed (owner_sub=%s, error=%s)",
                owner_sub, type(exc).__name__,
            )
            return None

        memory = (memory_row.memory if memory_row else {}) or {}
        memory_lines = []
        for key, label in _MEMORY_LABELS.items():
            value = memory.get(key)
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value if v)
            if value:
                memory_lines.append(f"{label}: {value}")
        if not memory_lines:
            return None
        return _truncate("Known preferences: " + " | ".join(memory_lines), _MAX_MEMORY_CONTEXT_CHARS)
    finally:
        context_session.close()


def _build_summary_context(conversation):
    """Cached conversation summary, or None if none exists yet. Reads only
    the already-loaded `conversation.summary` attribute on the ORM object
    the route already fetched via its own session - no additional query, so
    there is no separate-session concern here. Summary generation is not
    implemented until a later phase, so this is currently always None in
    practice - the block is wired in now so it takes effect automatically
    once summaries start being written."""
    summary = (conversation.summary or "").strip()
    if not summary:
        return None
    return _truncate(summary, _MAX_SUMMARY_CONTEXT_CHARS)


def _build_recipe_context(owner_sub):
    """Compact catalog of the authenticated user's own recipes, or None.
    Only fetches id/title/category/cuisine/description - never ingredients,
    steps, comments, images, or ownership fields - and only for recipes
    owned by owner_sub. Runs in its own short-lived DB session, isolated the
    same way as _build_profile_context. Degrades safely: a recipe lookup
    failure omits this block rather than failing the chat."""
    context_session = get_session()
    try:
        try:
            recipes = (
                context_session.query(
                    Recipe.id, Recipe.title, Recipe.category, Recipe.cuisine, Recipe.description
                )
                .filter(Recipe.owner_sub == owner_sub)
                .order_by(Recipe.id.desc())
                .limit(_MAX_RECIPE_CATALOG)
                .all()
            )
        except Exception as exc:
            context_session.rollback()
            logger.warning(
                "Robo Chef context: recipe lookup failed (owner_sub=%s, error=%s)",
                owner_sub, type(exc).__name__,
            )
            return None

        if not recipes:
            return None

        catalog_lines = [
            f"- {recipe.title} ({recipe.category}/{recipe.cuisine}): "
            f"{_truncate(_normalize_text(recipe.description or ''), _MAX_RECIPE_DESCRIPTION_CHARS)}"
            for recipe in recipes
        ]
        return "Their saved recipes:\n" + "\n".join(catalog_lines)
    finally:
        context_session.close()


def _build_system_context(conversation):
    """Assembles the bounded, server-built system context for one reply:
    profile, memory, summary, then recipes - each independently optional and
    each independently failure-isolated in its own short-lived DB session
    (summary needs no query at all - see _build_summary_context).
    `conversation.owner_sub` is used as the scoping identity rather than
    trusting anything client-supplied; by the time this runs the
    conversation has already been loaded through _get_owned_conversation(),
    which filtered on the authenticated sub, so this is guaranteed to equal
    the caller's own Cognito sub. Captured once here, before any optional
    query runs, so every block uses the same already-authorized value."""
    owner_sub = conversation.owner_sub
    blocks = [
        _build_profile_context(owner_sub),
        _build_memory_context(owner_sub),
        _build_summary_context(conversation),
        _build_recipe_context(owner_sub),
    ]
    return "\n\n".join(block for block in blocks if block)


def _recent_history(session, conversation_id, exclude_message_id):
    """Last _MAX_RECENT_MESSAGES messages from this conversation only,
    oldest first, excluding the just-inserted pending message (it is sent
    exactly once, as the final user turn - never duplicated into history).
    Each message's content is truncated to _MAX_HISTORY_MESSAGE_CHARS for
    context purposes only; the stored message content is never modified."""
    messages = (
        session.query(AiMessage)
        .filter(AiMessage.conversation_id == conversation_id, AiMessage.id != exclude_message_id)
        .order_by(AiMessage.id.desc())
        .limit(_MAX_RECENT_MESSAGES)
        .all()
    )
    messages.reverse()
    return [
        {"role": message.role, "content": _truncate(message.content, _MAX_HISTORY_MESSAGE_CHARS)}
        for message in messages
    ]


def _validate_memory_updates(memory_updates):
    """Allowlist + shape/size validation of memoryUpdates - untrusted model
    output from ask_robo_chef_structured(). Unknown keys are dropped.
    Malformed values are dropped per-item (a too-long or non-string item is
    skipped; the rest of a list field is still used) or per-field (a
    non-list value for a list field, or an invalid cookingSkill, drops that
    whole field) - never the whole payload. Returns a dict containing only
    the fields/items that passed validation; may be empty. Never raises."""
    if not isinstance(memory_updates, dict):
        return {}

    validated = {}

    for field, max_item_len in _MEMORY_ITEM_MAX_CHARS.items():
        raw_values = memory_updates.get(field)
        if not isinstance(raw_values, list):
            continue
        cleaned = []
        for item in raw_values:
            if not isinstance(item, str):
                continue
            trimmed = item.strip()
            if not trimmed or len(trimmed) > max_item_len:
                continue
            cleaned.append(trimmed)
        if cleaned:
            validated[field] = cleaned

    skill = memory_updates.get("cookingSkill")
    if isinstance(skill, str) and skill in _MEMORY_SKILL_VALUES:
        validated["cookingSkill"] = skill

    return validated


def _merge_memory_list(existing_items, new_items, max_items):
    """Additive, case-insensitive-deduped merge. Existing entries are never
    removed to make room for new ones - once at the cap, new items are
    simply not added rather than evicting anything already stored."""
    merged = list(existing_items)
    seen_lower = {item.lower() for item in merged if isinstance(item, str)}
    for item in new_items:
        if item.lower() in seen_lower:
            continue
        if len(merged) >= max_items:
            break
        merged.append(item)
        seen_lower.add(item.lower())
    return merged


def _merge_memory(existing_memory, validated_updates):
    """Merges validated_updates into existing_memory and returns a new dict
    (existing_memory is not mutated). List fields merge additively per
    _merge_memory_list; cookingSkill is overwritten only when a valid new
    value is present (it is a current-state fact, not a cumulative list).
    Any key not present in validated_updates - and any key in
    existing_memory that automatic extraction doesn't know about at all -
    is left completely untouched."""
    merged = dict(existing_memory or {})

    for field, max_items in _MEMORY_LIST_MAX_ITEMS.items():
        new_items = validated_updates.get(field)
        if not new_items:
            continue
        current = merged.get(field)
        current = list(current) if isinstance(current, list) else []
        merged[field] = _merge_memory_list(current, new_items, max_items)

    skill = validated_updates.get("cookingSkill")
    if skill:
        merged["cookingSkill"] = skill

    return merged


def _fits_memory_size_budget(memory_dict):
    try:
        return len(json.dumps(memory_dict).encode("utf-8")) <= _MAX_MEMORY_SERIALIZED_BYTES
    except (TypeError, ValueError):
        return False


def _persist_memory_updates(owner_sub, memory_updates):
    """Validates and merges memory_updates (untrusted model output) into
    AiUserMemory for owner_sub, using its own short-lived DB session -
    never the route session that already committed the assistant message
    and conversation update. Must be called only after that commit, and
    only with a payload the caller is prepared to have silently dropped:
    this function never raises and never returns anything, so a failure
    here (validation bug, DB error, oversized result) can only ever mean
    "the memory wasn't updated this turn" - it can never undo the already
    persisted assistant reply or change an already-decided HTTP response."""
    try:
        validated = _validate_memory_updates(memory_updates)
        if not validated:
            return

        memory_session = get_session()
        try:
            try:
                memory_row = memory_session.query(AiUserMemory).filter_by(owner_sub=owner_sub).first()
                existing_memory = (memory_row.memory if memory_row else {}) or {}
                merged = _merge_memory(existing_memory, validated)

                if not _fits_memory_size_budget(merged):
                    logger.warning(
                        "Robo Chef memory: merged memory exceeds %d bytes, skipping write (owner_sub=%s)",
                        _MAX_MEMORY_SERIALIZED_BYTES, owner_sub,
                    )
                    return

                if memory_row is None:
                    memory_session.add(AiUserMemory(owner_sub=owner_sub, memory=merged))
                else:
                    memory_row.memory = merged

                memory_session.commit()
            except Exception as exc:
                memory_session.rollback()
                logger.warning(
                    "Robo Chef memory: persistence failed (owner_sub=%s, error=%s)",
                    owner_sub, type(exc).__name__,
                )
        finally:
            memory_session.close()
    except Exception as exc:
        # Defense in depth: even a bug in validation/merge itself must never
        # affect a response that has already been decided.
        logger.warning(
            "Robo Chef memory: unexpected failure while persisting (owner_sub=%s, error=%s)",
            owner_sub, type(exc).__name__,
        )


def _generate_summary(existing_summary, messages):
    """One plain-text OpenAI call (the /api/ai/ask-compatible ask_robo_chef,
    not the structured-output path - a summary is free text, not a
    {answer, memoryUpdates} object) that folds `messages` into
    `existing_summary`. Returns a string truncated to
    _MAX_SUMMARY_CONTEXT_CHARS. Raises whatever ask_robo_chef raises on an
    SDK/network failure - the caller is responsible for catching that and
    skipping the summary update safely."""
    transcript = "\n".join(f"{message.role}: {message.content}" for message in messages)
    prompt = (
        "Summarize the following older portion of a cooking conversation in "
        "under 800 characters. Keep only durable cooking preferences, "
        "constraints, and recipe/cooking decisions already discussed, plus "
        "context useful for continuing the conversation later. Do not "
        "include emails, URLs, IDs, tokens, raw verbatim message text, or "
        "unrelated casual chatter. Write compact plain prose, not a "
        "transcript, and output only the summary text itself with no "
        "preamble.\n\n"
        f"Existing summary so far (may be empty): {existing_summary or '(none yet)'}\n\n"
        f"Older messages to fold in:\n{transcript}"
    )
    summary = ask_robo_chef(prompt, None)
    return _truncate(_normalize_text(summary), _MAX_SUMMARY_CONTEXT_CHARS)


def _maybe_summarize_conversation(conversation_id):
    """Best-effort: if enough unsummarized history exists older than the
    latest _MAX_RECENT_MESSAGES verbatim window, generates an updated
    summary and writes it with an optimistic compare-and-set on
    summarized_through_message_id, so a stale generated summary from a
    slow/racing call can never overwrite a newer one. Uses its own
    short-lived sessions throughout - never the route's session. Never
    raises: any failure here (no OpenAI, DB error, stale checkpoint) simply
    means the summary wasn't updated this turn. Must only be called after
    the assistant message is already committed and memory persistence has
    already been attempted - both are already durable/decided by the time
    this runs and are never touched by it. `conversation_id` is trusted
    here because callers only ever pass an id already authorized earlier in
    the same request via _get_owned_conversation()."""
    try:
        read_session = get_session()
        try:
            conversation = read_session.query(AiConversation).filter_by(id=conversation_id).first()
            if conversation is None:
                return

            recent_ids = [
                row.id for row in read_session.query(AiMessage.id)
                .filter(AiMessage.conversation_id == conversation_id)
                .order_by(AiMessage.id.desc())
                .limit(_MAX_RECENT_MESSAGES)
                .all()
            ]
            if len(recent_ids) < _MAX_RECENT_MESSAGES:
                return  # not enough history yet for anything to be eligible

            keep_from_id = min(recent_ids)  # oldest id among the latest 10 - never summarized
            expected_previous_checkpoint = conversation.summarized_through_message_id or 0

            unsummarized_count = (
                read_session.query(func.count(AiMessage.id))
                .filter(
                    AiMessage.conversation_id == conversation_id,
                    AiMessage.id > expected_previous_checkpoint,
                    AiMessage.id < keep_from_id,
                )
                .scalar()
            )
            if unsummarized_count <= _SUMMARY_UNSUMMARIZED_THRESHOLD:
                return

            batch = (
                read_session.query(AiMessage)
                .filter(
                    AiMessage.conversation_id == conversation_id,
                    AiMessage.id > expected_previous_checkpoint,
                    AiMessage.id < keep_from_id,
                )
                .order_by(AiMessage.id.asc())
                .all()
            )
            if not batch:
                return
            new_checkpoint = batch[-1].id
            existing_summary = conversation.summary
        finally:
            read_session.close()

        try:
            new_summary = _generate_summary(existing_summary, batch)
        except Exception as exc:
            logger.warning(
                "Robo Chef summary: generation failed (conversation_id=%s, error=%s)",
                conversation_id, type(exc).__name__,
            )
            return

        write_session = get_session()
        try:
            try:
                locked = (
                    write_session.query(AiConversation)
                    .filter(AiConversation.id == conversation_id)
                    .with_for_update()
                    .first()
                )
                if locked is None:
                    return

                current_checkpoint = locked.summarized_through_message_id or 0
                if current_checkpoint != expected_previous_checkpoint:
                    # The checkpoint moved since we started reading (a
                    # concurrent summarization already committed) - discard
                    # this generated summary rather than overwrite a newer
                    # one, and leave the checkpoint exactly as it is.
                    write_session.rollback()
                    return

                locked.summary = new_summary
                locked.summarized_through_message_id = new_checkpoint
                write_session.commit()
            except Exception as exc:
                write_session.rollback()
                logger.warning(
                    "Robo Chef summary: persistence failed (conversation_id=%s, error=%s)",
                    conversation_id, type(exc).__name__,
                )
        finally:
            write_session.close()
    except Exception as exc:
        # Defense in depth: even a bug in this function's own logic must
        # never affect a chat response that has already been decided.
        logger.warning(
            "Robo Chef summary: unexpected failure (conversation_id=%s, error=%s)",
            conversation_id, type(exc).__name__,
        )


def _generate_reply(session, conversation, pending_message):
    system_context = _build_system_context(conversation)
    history = _recent_history(session, conversation.id, exclude_message_id=pending_message.id)
    context = {"systemContext": system_context, "history": history}
    return ask_robo_chef_structured(pending_message.content, context)


@ai_conversations_bp.route("", methods=["GET"])
@require_auth
def list_conversations():
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    try:
        limit = min(max(int(request.args.get("limit", 20)), 1), 50)
    except (TypeError, ValueError):
        limit = 20

    session = get_session()
    try:
        conversations = (
            session.query(AiConversation)
            .filter(AiConversation.owner_sub == owner_sub)
            .order_by(AiConversation.updated_at.desc())
            .limit(limit)
            .all()
        )
        return jsonify({"data": [_serialize_conversation(c) for c in conversations]})
    finally:
        session.close()


@ai_conversations_bp.route("", methods=["POST"])
@require_auth
def create_conversation():
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    session = get_session()
    try:
        conversation = AiConversation(owner_sub=owner_sub)
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
        return jsonify({"data": _serialize_conversation(conversation)}), 201
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@ai_conversations_bp.route("/<int:conversation_id>", methods=["GET"])
@require_auth
def get_conversation(conversation_id):
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    session = get_session()
    try:
        conversation = _get_owned_conversation(session, conversation_id, owner_sub)
        if conversation is None:
            return jsonify({"error": "Conversation not found"}), 404

        messages = (
            session.query(AiMessage)
            .filter(AiMessage.conversation_id == conversation.id)
            .order_by(AiMessage.id.desc())
            .limit(100)
            .all()
        )
        messages.reverse()

        return jsonify({
            "data": {
                **_serialize_conversation(conversation),
                "messages": [_serialize_message(m) for m in messages],
            }
        })
    finally:
        session.close()


@ai_conversations_bp.route("/<int:conversation_id>", methods=["PATCH"])
@require_auth
def rename_conversation(conversation_id):
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    payload = request.get_json(silent=True) or {}
    title = _normalize_text(payload.get("title") or "")
    if not title:
        return jsonify({"error": "title is required"}), 400
    title = _truncate(title, _MAX_TITLE_LENGTH)

    session = get_session()
    try:
        conversation = _get_owned_conversation(session, conversation_id, owner_sub)
        if conversation is None:
            return jsonify({"error": "Conversation not found"}), 404

        conversation.title = title
        session.commit()
        session.refresh(conversation)
        return jsonify({"data": _serialize_conversation(conversation)})
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@ai_conversations_bp.route("/<int:conversation_id>", methods=["DELETE"])
@require_auth
def delete_conversation(conversation_id):
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    session = get_session()
    try:
        conversation = _get_owned_conversation(session, conversation_id, owner_sub)
        if conversation is None:
            return jsonify({"error": "Conversation not found"}), 404

        session.query(AiMessage).filter(AiMessage.conversation_id == conversation.id).delete()
        session.delete(conversation)
        session.commit()
        return jsonify({"data": {"deleted": True, "id": conversation_id}})
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@ai_conversations_bp.route("/<int:conversation_id>/messages", methods=["POST"])
@require_auth
def send_message(conversation_id):
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    payload = request.get_json(silent=True) or {}
    text = (payload.get("message") or "").strip()
    if not text:
        return jsonify({"error": "message is required"}), 400
    if len(text) > _MAX_MESSAGE_LENGTH:
        return jsonify({"error": f"message must be {_MAX_MESSAGE_LENGTH} characters or fewer"}), 400

    session = get_session()
    try:
        conversation = _get_owned_conversation(session, conversation_id, owner_sub)
        if conversation is None:
            return jsonify({"error": "Conversation not found"}), 404

        if _is_rate_limited(session, owner_sub):
            return jsonify({"error": "You're sending messages too quickly. Please wait a moment."}), 429

        # Lock the conversation row for the remainder of this
        # check-then-insert sequence, so two concurrent sends for the same
        # conversation (a double-click, a retried network request, multiple
        # tabs) can't both pass the pending-message check before either
        # commits. A concurrent second request blocks here until the
        # first's user-message commit below releases the lock, then
        # correctly observes the now-pending message and gets a 409. (No-op
        # on SQLite, which has no row-level locking; effective on MySQL
        # InnoDB in production.)
        session.query(AiConversation).filter(AiConversation.id == conversation.id).with_for_update().first()

        last_message = (
            session.query(AiMessage)
            .filter(AiMessage.conversation_id == conversation.id)
            .order_by(AiMessage.id.desc())
            .first()
        )
        if last_message is not None and last_message.role == "user":
            # A user message is already pending a reply. Enforced
            # server-side regardless of frontend send-button state: the
            # caller should retry that message instead of creating another
            # one - never insert a second pending user message.
            return jsonify({
                "error": "This conversation has a reply pending. Retry it instead of sending a new message.",
                "data": {"conversation": _serialize_conversation(conversation)},
            }), 409

        is_first_message = last_message is None

        user_message = AiMessage(conversation_id=conversation.id, role="user", content=text)
        session.add(user_message)
        if is_first_message:
            conversation.title = _truncate(_normalize_text(text), 60)
        conversation.preview = _truncate(_normalize_text(text), 100)
        conversation.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(user_message)
        session.refresh(conversation)

        try:
            reply_text, memory_updates = _generate_reply(session, conversation, user_message)
        except Exception as exc:
            return jsonify({
                "error": f"Robo Chef is currently unavailable: {exc}",
                "data": {
                    "userMessage": _serialize_message(user_message),
                    "conversation": _serialize_conversation(conversation),
                },
            }), 502

        assistant_message = AiMessage(conversation_id=conversation.id, role="assistant", content=reply_text)
        session.add(assistant_message)
        conversation.preview = _truncate(_normalize_text(reply_text), 100)
        conversation.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(assistant_message)
        session.refresh(conversation)

        response_payload = {
            "data": {
                "userMessage": _serialize_message(user_message),
                "assistantMessage": _serialize_message(assistant_message),
                "conversation": _serialize_conversation(conversation),
            }
        }

        # Only after the assistant message is durably committed and the
        # response body is already decided. memoryUpdates is never included
        # in response_payload above - it is not exposed to the frontend.
        _persist_memory_updates(conversation.owner_sub, memory_updates)
        _maybe_summarize_conversation(conversation.id)

        return jsonify(response_payload), 201
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@ai_conversations_bp.route("/<int:conversation_id>/messages/retry", methods=["POST"])
@require_auth
def retry_message(conversation_id):
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    session = get_session()
    try:
        conversation = _get_owned_conversation(session, conversation_id, owner_sub)
        if conversation is None:
            return jsonify({"error": "Conversation not found"}), 404

        last_message = (
            session.query(AiMessage)
            .filter(AiMessage.conversation_id == conversation.id)
            .order_by(AiMessage.id.desc())
            .first()
        )
        if last_message is None or last_message.role != "user":
            return jsonify({"error": "There is no pending message to retry"}), 400

        try:
            reply_text, memory_updates = _generate_reply(session, conversation, last_message)
        except Exception as exc:
            return jsonify({"error": f"Robo Chef is currently unavailable: {exc}"}), 502

        assistant_message = AiMessage(conversation_id=conversation.id, role="assistant", content=reply_text)
        session.add(assistant_message)
        conversation.preview = _truncate(_normalize_text(reply_text), 100)
        conversation.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(assistant_message)
        session.refresh(conversation)

        response_payload = {
            "data": {
                "assistantMessage": _serialize_message(assistant_message),
                "conversation": _serialize_conversation(conversation),
            }
        }

        _persist_memory_updates(conversation.owner_sub, memory_updates)
        _maybe_summarize_conversation(conversation.id)

        return jsonify(response_payload), 201
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@ai_memory_bp.route("", methods=["GET"])
@require_auth
def get_memory():
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    session = get_session()
    try:
        memory_row = session.query(AiUserMemory).filter_by(owner_sub=owner_sub).first()
        return jsonify({"data": {"memory": (memory_row.memory if memory_row else {}) or {}}})
    finally:
        session.close()


@ai_memory_bp.route("", methods=["PATCH"])
@require_auth
def update_memory():
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    owner_sub = g.current_user["sub"]
    payload = request.get_json(silent=True) or {}
    updates = payload.get("memory")
    if not isinstance(updates, dict):
        return jsonify({"error": "memory must be an object"}), 400

    session = get_session()
    try:
        memory_row = session.query(AiUserMemory).filter_by(owner_sub=owner_sub).first()
        if memory_row is None:
            memory_row = AiUserMemory(owner_sub=owner_sub, memory={})
            session.add(memory_row)

        current = dict(memory_row.memory or {})
        for key, value in updates.items():
            if key not in _MEMORY_ALLOWED_KEYS:
                continue
            if value is None:
                current.pop(key, None)
            else:
                current[key] = value
        memory_row.memory = current

        session.commit()
        session.refresh(memory_row)
        return jsonify({"data": {"memory": memory_row.memory or {}}})
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
