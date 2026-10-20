"""Context management for agent conversations.

Provides conversation context tracking across agent interactions.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ConversationTurn:
    """Single turn in a conversation."""

    role: str  # user, agent, system
    content: str
    agent_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConversationContext:
    """Tracks conversation history for an incident."""

    incident_id: str
    turns: List[ConversationTurn] = field(default_factory=list)
    working_memory: Dict[str, Any] = field(default_factory=dict)
    agent_memory: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def add_turn(
        self,
        role: str,
        content: str,
        agent_id: Optional[str] = None,
        **metadata: Any,
    ) -> None:
        """Add a conversation turn."""
        self.turns.append(
            ConversationTurn(
                role=role,
                content=content,
                agent_id=agent_id,
                metadata=metadata,
            )
        )

    def get_agent_memory(self, agent_id: str) -> Dict[str, Any]:
        """Get working memory for a specific agent."""
        return self.agent_memory.setdefault(agent_id, {})

    def set_agent_memory(self, agent_id: str, key: str, value: Any) -> None:
        """Set a value in agent-specific working memory."""
        self.agent_memory.setdefault(agent_id, {})[key] = value

    def get_recent_turns(self, n: int = 10) -> List[ConversationTurn]:
        """Get the last N conversation turns."""
        return self.turns[-n:]

    def to_prompt_context(self, max_turns: int = 20) -> str:
        """Format conversation as prompt context for LLM calls."""
        recent = self.get_recent_turns(max_turns)
        lines = []
        for turn in recent:
            prefix = turn.role.upper()
            if turn.agent_id:
                prefix += f" ({turn.agent_id})"
            lines.append(f"[{prefix}]: {turn.content}")
        return "\n".join(lines)


class ContextManager:
    """Manages conversation contexts across incidents."""

    def __init__(self) -> None:
        self._contexts: Dict[str, ConversationContext] = {}

    def get_or_create(self, incident_id: str) -> ConversationContext:
        """Get existing context or create new one for an incident."""
        if incident_id not in self._contexts:
            self._contexts[incident_id] = ConversationContext(incident_id=incident_id)
        return self._contexts[incident_id]

    def get(self, incident_id: str) -> Optional[ConversationContext]:
        return self._contexts.get(incident_id)

    def delete(self, incident_id: str) -> None:
        self._contexts.pop(incident_id, None)

    def list_incidents(self) -> List[str]:
        return list(self._contexts.keys())


# Singleton
_context_manager = ContextManager()


def get_context_manager() -> ContextManager:
    return _context_manager
