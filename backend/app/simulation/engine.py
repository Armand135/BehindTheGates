"""Minimal discrete-event simulation core.

A binary-heap priority queue of (time, sequence, callback) tuples. `time` is
simulated hours since run start (a float), independent of wall-clock time --
the "configurable time acceleration" requirement is handled by whoever
drives the loop (see `runner.py`), which can either drain the queue as fast
as possible (batch mode, for generating history / training data) or pace
`pop()` calls in real time according to an acceleration factor (live mode,
for the digital twin).
"""
import heapq
import itertools
from dataclasses import dataclass, field
from typing import Callable


@dataclass(order=True)
class ScheduledEvent:
    time: float
    seq: int
    callback: Callable[[], None] = field(compare=False)
    name: str = field(default="", compare=False)


class EventQueue:
    def __init__(self) -> None:
        self._heap: list[ScheduledEvent] = []
        self._counter = itertools.count()

    def schedule(self, time: float, callback: Callable[[], None], name: str = "") -> None:
        heapq.heappush(self._heap, ScheduledEvent(time, next(self._counter), callback, name))

    def pop(self) -> ScheduledEvent | None:
        if not self._heap:
            return None
        return heapq.heappop(self._heap)

    def peek_time(self) -> float | None:
        return self._heap[0].time if self._heap else None

    def __len__(self) -> int:
        return len(self._heap)
