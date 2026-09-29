"""
Defines the discovery strategies used to find sports academies.

Groups Google search queries targeting government sports departments, sports authority of india (SAI),
private academies, discipline-specific clubs (Cricket, Football, Badminton, etc.), and local directories for a specific location.
"""

from dataclasses import dataclass
from typing import List


@dataclass
class DiscoveryStrategy:
    name: str
    queries: List[str]
    source_types: List[str]


def get_discovery_strategies(location: str = "Delhi") -> List[DiscoveryStrategy]:
    loc = location.strip()
    return [
        DiscoveryStrategy(
            name="government_sai_academies",
            queries=[
                f"site:gov.in sports academy {loc}",
                f"Sports Authority of India {loc} training academy center",
                f"site:gov.in sports coaching center {loc}",
                f"site:gov.in sports department academy admissions {loc}",
                f"state sports council academy {loc}",
                f"government sports hostel and academy in {loc}",
                f"site:sportsauthorityofindia.nic.in {loc} center",
                f"site:gov.in sports scholarship training academy {loc}",
            ],
            source_types=["GOVERNMENT", "SAI"],
        ),
        DiscoveryStrategy(
            name="top_private_sports_academies",
            queries=[
                f"best sports academies in {loc} admission fees",
                f"top sports training academy in {loc} contact details",
                f"sports complex coaching center {loc} join",
                f"sports club academy {loc} membership coaching",
                f"professional sports training center in {loc}",
                f"sports academy in {loc} registration online",
                f"sports coaching academy in {loc} for kids and youth",
            ],
            source_types=["PRIVATE", "CLUB"],
        ),
        DiscoveryStrategy(
            name="discipline_specific_academies",
            queries=[
                f"best cricket academy in {loc} coaching fees contact",
                f"badminton training academy in {loc} admissions",
                f"football academy in {loc} trial registration",
                f"lawn tennis academy in {loc} coaching center",
                f"swimming academy and coaching in {loc}",
                f"basketball academy in {loc} training center",
                f"table tennis academy in {loc}",
                f"martial arts karate taekwondo boxing academy in {loc}",
                f"athletics sports training academy in {loc}",
                f"shooting academy in {loc} range coaching",
                f"chess training academy in {loc}",
                f"archery training academy in {loc}",
            ],
            source_types=["CRICKET", "FOOTBALL", "BADMINTON", "TENNIS", "MULTI_SPORT"],
        ),
        DiscoveryStrategy(
            name="academy_directories_portals",
            queries=[
                f"list of top sports academies in {loc}",
                f"directory of sports coaching academies in {loc}",
                f"sports academies list {loc} contact info address",
                f"best sports training centers in {loc} reviews",
                f"sports academy admissions open 2026 {loc}",
            ],
            source_types=["AGGREGATOR", "DIRECTORY"],
        ),
    ]


# Default fallback instance for Delhi
DISCOVERY_STRATEGIES = get_discovery_strategies("Delhi")
