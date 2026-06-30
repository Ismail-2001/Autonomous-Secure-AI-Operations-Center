"""A-SOC Worker: Background task processor for LangGraph incident workflows."""
import asyncio
import os
import signal
import sys

from src.asoc.core.logging import get_logger

logger = get_logger("asoc.worker")

_shutdown = asyncio.Event()


def _handle_signal(sig: signal.Signals) -> None:
    logger.info("worker_shutdown_signal", signal=sig.name)
    _shutdown.set()


async def _process_incidents() -> None:
    """Poll for pending incidents and run them through the workflow graph."""
    from src.asoc.core.checkpoint import get_or_create_checkpointer
    from src.asoc.orchestration.workflow import build_graph

    logger.info("worker_initializing")
    checkpointer = await get_or_create_checkpointer()
    graph = build_graph()

    logger.info("worker_ready", graph_nodes=list(graph.nodes.keys()) if hasattr(graph, "nodes") else "unknown")

    while not _shutdown.is_set():
        try:
            await asyncio.sleep(float(os.getenv("WORKER_POLL_INTERVAL", "5")))
        except asyncio.CancelledError:
            break

    logger.info("worker_stopped")


async def main() -> None:
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal, sig)
        except NotImplementedError:
            pass

    await _process_incidents()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("worker_interrupted")
        sys.exit(0)
