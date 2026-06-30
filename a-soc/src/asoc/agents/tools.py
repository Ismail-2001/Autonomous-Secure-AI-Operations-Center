import abc
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("asoc.agents.tools")


@dataclass
class ToolDefinition:
    name: str
    description: str
    func: Callable
    input_schema: Dict[str, Any] = field(default_factory=dict)
    output_schema: Dict[str, Any] = field(default_factory=dict)
    is_high_risk: bool = False
    requires_authorization: bool = False


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        func: Callable,
        description: str,
        input_schema: Optional[Dict[str, Any]] = None,
        output_schema: Optional[Dict[str, Any]] = None,
        is_high_risk: bool = False,
        requires_authorization: bool = False,
    ) -> None:
        self._tools[name] = ToolDefinition(
            name=name,
            description=description,
            func=func,
            input_schema=input_schema or {},
            output_schema=output_schema or {},
            is_high_risk=is_high_risk,
            requires_authorization=requires_authorization,
        )
        logger.debug("tool_registered", extra={"tool": name, "high_risk": is_high_risk})

    def get(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    def list_tools(self) -> List[ToolDefinition]:
        return list(self._tools.values())

    def list_tool_names(self) -> List[str]:
        return list(self._tools.keys())

    async def execute(self, tool_name: str, **kwargs: Any) -> Any:
        tool = self._tools.get(tool_name)
        if tool is None:
            raise ValueError(f"Tool '{tool_name}' not registered")
        logger.info("tool_executing", extra={"tool": tool_name, "args": list(kwargs.keys())})
        result = await tool.func(**kwargs)
        logger.info("tool_completed", extra={"tool": tool_name})
        return result

    def get_langchain_tools(self) -> List[Any]:
        from langchain_core.tools import StructuredTool

        lc_tools = []
        for tool_def in self._tools.values():
            lc_tool = StructuredTool(
                name=tool_def.name,
                description=tool_def.description,
                func=tool_def.func,
                args_schema=None,
            )
            lc_tools.append(lc_tool)
        return lc_tools

    def validate_tool_call(self, tool_name: str, is_authorized: bool = False, rate_limited: bool = False) -> bool:
        if tool_name not in self._tools:
            logger.warning("tool_not_found", extra={"tool": tool_name})
            return False
        tool = self._tools[tool_name]
        if tool.requires_authorization and not is_authorized:
            logger.warning("tool_requires_authorization", extra={"tool": tool_name})
            return False
        if rate_limited:
            logger.warning("tool_rate_limited", extra={"tool": tool_name})
            return False
        return True
