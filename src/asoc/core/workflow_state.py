"""Workflow state machine for agent orchestration.

Defines valid state transitions and prevents invalid state changes.
"""

from enum import Enum
from typing import Dict, List, Optional, Set, Tuple


class WorkflowState(str, Enum):
    """Possible states in the agent workflow."""

    IDLE = "idle"
    INGESTING = "ingesting"
    ANALYZING = "analyzing"
    REVIEWING = "reviewing"
    INVESTIGATING = "investigating"
    RESPONDING = "responding"
    COMPLIANT = "compliant"
    NOTIFYING = "notifying"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


# Valid state transitions
TRANSITIONS: Dict[WorkflowState, Set[WorkflowState]] = {
    WorkflowState.IDLE: {WorkflowState.INGESTING, WorkflowState.FAILED},
    WorkflowState.INGESTING: {WorkflowState.ANALYZING, WorkflowState.FAILED},
    WorkflowState.ANALYZING: {WorkflowState.REVIEWING, WorkflowState.FAILED},
    WorkflowState.REVIEWING: {
        WorkflowState.INVESTIGATING,
        WorkflowState.RESPONDING,
        WorkflowState.BLOCKED,
        WorkflowState.FAILED,
    },
    WorkflowState.INVESTIGATING: {
        WorkflowState.RESPONDING,
        WorkflowState.COMPLETED,
        WorkflowState.FAILED,
    },
    WorkflowState.RESPONDING: {
        WorkflowState.COMPLIANT,
        WorkflowState.NOTIFYING,
        WorkflowState.FAILED,
    },
    WorkflowState.COMPLIANT: {WorkflowState.NOTIFYING, WorkflowState.FAILED},
    WorkflowState.NOTIFYING: {WorkflowState.COMPLETED, WorkflowState.FAILED},
    WorkflowState.COMPLETED: set(),
    WorkflowState.FAILED: {WorkflowState.IDLE},
    WorkflowState.BLOCKED: {WorkflowState.IDLE, WorkflowState.REVIEWING},
}


class WorkflowStateMachine:
    """Manages workflow state transitions with validation."""

    def __init__(self, initial: WorkflowState = WorkflowState.IDLE) -> None:
        self._state = initial
        self._history: List[Tuple[WorkflowState, WorkflowState]] = []

    @property
    def state(self) -> WorkflowState:
        return self._state

    @property
    def history(self) -> List[Tuple[WorkflowState, WorkflowState]]:
        return list(self._history)

    def can_transition(self, target: WorkflowState) -> bool:
        """Check if a transition to target state is valid."""
        return target in TRANSITIONS.get(self._state, set())

    def transition(self, target: WorkflowState) -> None:
        """Execute a state transition.

        Raises:
            ValueError: If the transition is not valid.
        """
        if not self.can_transition(target):
            raise ValueError(
                f"Invalid transition: {self._state.value} → {target.value}. "
                f"Valid targets: {[s.value for s in TRANSITIONS.get(self._state, set())]}"
            )
        self._history.append((self._state, target))
        self._state = target

    def reset(self) -> None:
        """Reset to idle state."""
        self._history.clear()
        self._state = WorkflowState.IDLE

    def is_terminal(self) -> bool:
        """Check if the workflow is in a terminal state."""
        return self._state in {WorkflowState.COMPLETED, WorkflowState.FAILED}
