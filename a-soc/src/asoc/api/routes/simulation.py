"""War Game & Adversarial Attack Simulation API routes."""

from typing import Optional

from fastapi import Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from src.asoc.core.jwt_handler import Role, TokenPayload, require_role
from src.asoc.tools.war_game import SCENARIOS, WarGameEngine, WarGameReport

from . import router


class RunWarGameRequest(BaseModel):
    scenario: str = Field(default="ransomware", description="Attack scenario key (e.g. ransomware, exfiltration)")
    mode: Optional[str] = Field(default="SHADOW", description="Execution mode (SHADOW or ACTIVE_ENFORCEMENT)")
    delay_between_steps: float = Field(default=0.05, ge=0.0, le=5.0)


@router.post("/simulation/war-game", response_model=WarGameReport, status_code=status.HTTP_200_OK)
async def run_war_game_simulation(
    request: RunWarGameRequest,
    current_user: TokenPayload = Depends(require_role(Role.ANALYST)),
):
    """Trigger an autonomous adversarial War Game simulation (Analyst or above)."""
    if request.scenario.lower() not in SCENARIOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scenario '{request.scenario}'. Available: {list(SCENARIOS.keys())}",
        )

    engine = WarGameEngine()
    try:
        report = await engine.run(
            scenario_key=request.scenario,
            execution_mode=request.mode,
            delay_between_steps=request.delay_between_steps,
        )
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"War Game simulation failed: {str(e)}",
        )


@router.get("/simulation/scenarios")
async def list_war_game_scenarios(
    current_user: TokenPayload = Depends(require_role(Role.ANALYST)),
):
    """List available adversarial attack scenarios and metadata."""
    return {
        key: {
            "name": data["name"],
            "threat_actor": data["threat_actor"],
            "target_host": data["target_host"],
            "stages_count": len(data["stages"]),
        }
        for key, data in SCENARIOS.items()
    }
